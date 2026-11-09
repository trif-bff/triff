import "server-only";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, session, user } from "@/db/schema";
import { estimateCost } from "@/lib/admin/costs";
import { can, checkUserChange, ForbiddenError, type Permission, type Plan, type Role } from "@/lib/admin/permissions";
import { aiConfig, providerStatus } from "@/lib/ai/provider";
import { getSettings } from "./settings";

/**
 * Admin read models and actions.
 * Privacy by design: the panel shows aggregates and metadata only — never the
 * content of students' notes, conversations or answers.
 */

export type Actor = { id: string; role: string };

export function assertCan(actor: Actor, p: Permission) {
  if (!can(actor.role, p)) throw new ForbiddenError("No tienes permiso para esta acción.");
}

async function audit(actor: Actor, action: string, target: string | null, meta: Record<string, unknown> = {}) {
  await db.insert(auditLog).values({ userId: actor.id, action, target, meta });
}

/* --------------------------------- Overview -------------------------------- */

export async function overview(actor: Actor) {
  assertCan(actor, "admin.view");
  const r = await db.execute<{
    users: number; new_7d: number; active_7d: number; banned: number; premium: number;
    documents: number; docs_failed: number; docs_ocr: number;
    ai_ops_30d: number; ai_failed_30d: number; ai_ops_today: number; mocks_30d: number;
  }>(sql`
    select
      (select count(*)::int from "user") as users,
      (select count(*)::int from "user" where created_at > now() - interval '7 days') as new_7d,
      (select count(distinct user_id)::int from evidence where created_at > now() - interval '7 days') as active_7d,
      (select count(*)::int from "user" where banned) as banned,
      (select count(*)::int from "user" where plan = 'premium') as premium,
      (select count(*)::int from documents) as documents,
      (select count(*)::int from documents where status = 'failed') as docs_failed,
      (select count(*)::int from documents where ocr_pages > 0) as docs_ocr,
      (select count(*)::int from ai_usage where created_at > now() - interval '30 days') as ai_ops_30d,
      (select count(*)::int from ai_usage where created_at > now() - interval '30 days' and not success) as ai_failed_30d,
      (select count(*)::int from ai_usage where created_at > date_trunc('day', now())) as ai_ops_today,
      (select count(*)::int from quizzes q join quiz_attempts a on a.quiz_id = q.id where q.kind = 'mock' and a.created_at > now() - interval '30 days') as mocks_30d`);
  const usage = await usageReport(actor, 30);
  return { ...r.rows[0], cost30d: usage.cost };
}

/* ---------------------------------- Users ---------------------------------- */

export async function listUsers(actor: Actor, opts: { q?: string; page?: number; pageSize?: number } = {}) {
  assertCan(actor, "users.view");
  const pageSize = Math.min(opts.pageSize ?? 25, 100);
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim().slice(0, 100);
  const where = q ? or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`)) : undefined;
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
      banned: user.banned,
      createdAt: user.createdAt,
      documents: sql<number>`(select count(*)::int from documents d where d.user_id = "user".id)`,
      lastActive: sql<Date | null>`(select max(created_at) from evidence e where e.user_id = "user".id)`,
      aiOps30d: sql<number>`(select count(*)::int from ai_usage u where u.user_id = "user".id and u.created_at > now() - interval '30 days')`,
      xp: sql<number>`(select coalesce(sum(amount),0)::int from xp_events x where x.user_id = "user".id)`,
    })
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ n }] = await db.select({ n: count() }).from(user).where(where);
  return { rows, total: n, page, pageSize };
}

async function adminCount() {
  const [{ n }] = await db.select({ n: count() }).from(user).where(and(eq(user.role, "admin"), eq(user.banned, false)));
  return n;
}

async function loadTarget(id: string) {
  const [t] = await db.select({ id: user.id, role: user.role, banned: user.banned, email: user.email }).from(user).where(eq(user.id, id));
  return t ?? null;
}

export async function setUserRole(actor: Actor, targetId: string, role: Role) {
  const target = await loadTarget(targetId);
  if (!target) return { error: "Usuario no encontrado" };
  const err = checkUserChange({ actor, target, change: { role }, adminCount: await adminCount() });
  if (err) return { error: err };
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, targetId));
  await audit(actor, "user.role_changed", targetId, { from: target.role, to: role });
  return { ok: true };
}

export async function setUserPlan(actor: Actor, targetId: string, plan: Plan) {
  assertCan(actor, "users.manage");
  const target = await loadTarget(targetId);
  if (!target) return { error: "Usuario no encontrado" };
  await db.update(user).set({ plan, updatedAt: new Date() }).where(eq(user.id, targetId));
  await audit(actor, "user.plan_changed", targetId, { to: plan });
  return { ok: true };
}

/** Suspends (and signs out everywhere) or reactivates an account. */
export async function setUserBanned(actor: Actor, targetId: string, banned: boolean, reason?: string) {
  const target = await loadTarget(targetId);
  if (!target) return { error: "Usuario no encontrado" };
  const err = checkUserChange({ actor, target, change: { banned }, adminCount: await adminCount() });
  if (err) return { error: err };
  await db.update(user).set({ banned, bannedReason: banned ? (reason?.slice(0, 300) ?? null) : null, updatedAt: new Date() }).where(eq(user.id, targetId));
  if (banned) await db.delete(session).where(eq(session.userId, targetId));
  await audit(actor, banned ? "user.suspended" : "user.reactivated", targetId, reason ? { reason: reason.slice(0, 300) } : {});
  return { ok: true };
}

/* ------------------------------- AI usage & cost --------------------------- */

export async function usageReport(actor: Actor, days = 30) {
  assertCan(actor, "admin.view");
  const d = Math.min(Math.max(days, 1), 365);
  const settings = await getSettings();
  const byModel = await db.execute<{ model: string; provider: string; ops: number; failed: number; input: number; output: number }>(sql`
    select model, provider, count(*)::int as ops, count(*) filter (where not success)::int as failed,
           coalesce(sum(input_tokens),0)::int as input, coalesce(sum(output_tokens),0)::int as output
    from ai_usage where created_at > now() - make_interval(days => ${d}) group by 1, 2 order by ops desc`);
  const byFeature = await db.execute<{ feature: string; ops: number; failed: number }>(sql`
    select feature, count(*)::int as ops, count(*) filter (where not success)::int as failed
    from ai_usage where created_at > now() - make_interval(days => ${d}) group by 1 order by ops desc`);
  const byDay = await db.execute<{ day: string; ops: number; failed: number }>(sql`
    select to_char(created_at at time zone 'Europe/Madrid', 'YYYY-MM-DD') as day, count(*)::int as ops,
           count(*) filter (where not success)::int as failed
    from ai_usage where created_at > now() - make_interval(days => ${d}) group by 1 order by 1`);
  const topUsers = await db.execute<{ user_id: string; email: string; ops: number; input: number; output: number }>(sql`
    select u.user_id, us.email, count(*)::int as ops, coalesce(sum(u.input_tokens),0)::int as input, coalesce(sum(u.output_tokens),0)::int as output
    from ai_usage u join "user" us on us.id = u.user_id
    where u.created_at > now() - make_interval(days => ${d}) and u.billable
    group by 1, 2 order by ops desc limit 10`);
  const models = byModel.rows.map((m) => ({ ...m, cost: estimateCost([{ model: m.model, inputTokens: m.input, outputTokens: m.output }], settings.prices).total }));
  const cost = estimateCost(byModel.rows.map((m) => ({ model: m.model, inputTokens: m.input, outputTokens: m.output })), settings.prices);
  return { days: d, cost, byModel: models, byFeature: byFeature.rows, byDay: byDay.rows, topUsers: topUsers.rows };
}

/* ------------------------------ Errors & audit ----------------------------- */

export async function errorsReport(actor: Actor) {
  assertCan(actor, "admin.view");
  // Filename + error message only: enough to diagnose, without exposing note content.
  const failedDocs = await db.execute<{ id: string; filename: string; mime_type: string; error: string | null; created_at: Date; email: string }>(sql`
    select d.id, d.filename, d.mime_type, d.error, d.created_at, u.email
    from documents d join "user" u on u.id = d.user_id
    where d.status = 'failed' order by d.created_at desc limit 50`);
  const lowOcr = await db.execute<{ n: number }>(sql`select count(*)::int as n from documents where ocr_pages > 0 and ocr_confidence < 70`);
  const failedAi = await db.execute<{ feature: string; model: string; n: number; last: Date }>(sql`
    select feature, model, count(*)::int as n, max(created_at) as last
    from ai_usage where not success and created_at > now() - interval '30 days' group by 1, 2 order by n desc limit 20`);
  return { failedDocs: failedDocs.rows, lowOcr: lowOcr.rows[0]?.n ?? 0, failedAi: failedAi.rows };
}

export async function auditTrail(actor: Actor, opts: { limit?: number; onlyAdmin?: boolean } = {}) {
  assertCan(actor, "audit.view");
  const rows = await db
    .select({ id: auditLog.id, action: auditLog.action, target: auditLog.target, meta: auditLog.meta, createdAt: auditLog.createdAt, actorEmail: user.email })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.userId))
    .where(opts.onlyAdmin ? sql`${auditLog.action} like 'user.%' or ${auditLog.action} like 'settings.%'` : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.min(opts.limit ?? 50, 200));
  return rows;
}

/* --------------------------------- System ---------------------------------- */

export async function systemStatus(actor: Actor) {
  assertCan(actor, "settings.view");
  const settings = await getSettings();
  const cfg = aiConfig(settings.ai);
  const { ocrAvailable } = await import("@/lib/docs/ocr");
  return {
    providers: providerStatus(),
    activeProvider: cfg.provider,
    aiEnabled: cfg.enabled,
    models: cfg.models,
    embeddings: process.env.EMBEDDINGS_PROVIDER ?? "none",
    ocr: process.env.OCR_ENABLED === "false" ? false : await ocrAvailable(),
    settings,
  };
}
