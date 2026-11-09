import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { aiUsage, auditLog, session, user } from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/admin/settings-schema";
import { auth } from "@/lib/auth/server";
import { auditTrail, errorsReport, listUsers, overview, setUserBanned, setUserPlan, setUserRole, usageReport } from "@/lib/services/admin";
import { getSettings, invalidateSettingsCache, saveSettings } from "@/lib/services/settings";
import { assertQuota, dailyLimit } from "@/lib/services/usage";

const tag = randomUUID().slice(0, 8);
const ids = { admin: `adm-${tag}`, support: `sup-${tag}`, student: `stu-${tag}` };
const admin = { id: ids.admin, role: "admin" };
const support = { id: ids.support, role: "support" };
let signedUpId = "";
const email = `ban-${tag}@example.com`;
const password = "contraseña-segura-123";

beforeAll(async () => {
  await db.insert(user).values([
    { id: ids.admin, name: "Admin", email: `${ids.admin}@example.com`, role: "admin" },
    { id: ids.support, name: "Soporte", email: `${ids.support}@example.com`, role: "support" },
    { id: ids.student, name: "Estudiante", email: `${ids.student}@example.com` },
  ]);
  await db.insert(aiUsage).values([
    { userId: ids.student, feature: "tutor:explain", provider: "anthropic", model: "claude-opus-5-5", inputTokens: 6000, outputTokens: 800, success: true, billable: true },
    { userId: ids.student, feature: "quiz", provider: "anthropic", model: "claude-opus-5-5", inputTokens: 0, outputTokens: 0, success: false, billable: false },
  ]);
  const r = await auth.api.signUpEmail({ body: { name: "Baneable", email, password } });
  signedUpId = r.user.id;
});

afterAll(async () => {
  await db.delete(user).where(inArray(user.id, [ids.admin, ids.support, ids.student, signedUpId]));
  await db.execute(sql`delete from app_settings where key = 'config'`);
  invalidateSettingsCache();
  await pool.end();
});

describe("admin panel services", () => {
  it("lets support read but not manage", async () => {
    const list = await listUsers(support, { q: tag });
    expect(list.rows.map((r) => r.id).sort()).toEqual([ids.admin, ids.student, ids.support, signedUpId].sort());
    expect((await setUserRole(support, ids.student, "admin")).error).toMatch(/permiso/);
    await expect(setUserPlan(support, ids.student, "premium")).rejects.toThrow(/permiso/);
    expect((await saveSettings(support, DEFAULT_SETTINGS)).error).toMatch(/Solo un administrador/);
    await expect(listUsers({ id: ids.student, role: "student" })).rejects.toThrow(/permiso/);
  });

  it("protects against self-demotion and changes roles with an audit trail", async () => {
    expect((await setUserRole(admin, ids.admin, "student")).error).toMatch(/propio rol/);
    expect((await setUserRole(admin, ids.student, "support")).ok).toBe(true);
    const trail = await auditTrail(admin, { onlyAdmin: true });
    expect(trail.some((a) => a.action === "user.role_changed" && a.target === ids.student && a.actorEmail === `${ids.admin}@example.com`)).toBe(true);
  });

  it("applies plan limits from the settings", async () => {
    await saveSettings(admin, { ...DEFAULT_SETTINGS, plans: { free: { aiDailyLimit: 1 }, premium: { aiDailyLimit: 7 } } });
    expect((await getSettings()).plans.premium.aiDailyLimit).toBe(7);
    await setUserPlan(admin, ids.student, "premium");
    expect(await dailyLimit({ role: "student", plan: "premium" })).toBe(7);
    expect(await dailyLimit({ role: "student", plan: "free" })).toBe(1);
    // The student already has 1 billable op today: free plan would be blocked, premium is not.
    await expect(assertQuota({ id: ids.student, role: "student", plan: "free" })).rejects.toThrow(/límite diario de 1/);
    await expect(assertQuota({ id: ids.student, role: "student", plan: "premium" })).resolves.toMatchObject({ limit: 7 });
    const audit = await db.select().from(auditLog).where(eq(auditLog.action, "settings.updated"));
    expect(audit.length).toBeGreaterThan(0);
  });

  it("rejects invalid settings", async () => {
    const bad = { ...DEFAULT_SETTINGS, ai: { provider: null, models: { tutor: "x; drop table", generation: null } } };
    expect((await saveSettings(admin, bad)).error).toBeTruthy();
  });

  it("suspends a user: sessions revoked and new sign-ins refused", async () => {
    await auth.api.signInEmail({ body: { email, password } });
    expect((await db.select().from(session).where(eq(session.userId, signedUpId))).length).toBeGreaterThan(0);
    expect((await setUserBanned(admin, signedUpId, true, "spam")).ok).toBe(true);
    expect(await db.select().from(session).where(eq(session.userId, signedUpId))).toHaveLength(0);
    await expect(auth.api.signInEmail({ body: { email, password } })).rejects.toThrow();
    await setUserBanned(admin, signedUpId, false);
    await expect(auth.api.signInEmail({ body: { email, password } })).resolves.toBeTruthy();
  });

  it("reports usage with estimated cost and does not count failures", async () => {
    const u = await usageReport(admin, 30);
    const opus = u.byModel.find((m) => m.model === "claude-opus-5-5")!;
    expect(opus.ops).toBeGreaterThanOrEqual(2);
    expect(opus.failed).toBeGreaterThanOrEqual(1);
    expect(u.cost.total).toBeGreaterThanOrEqual(0.04);
    const top = u.topUsers.find((t) => t.user_id === ids.student)!;
    expect(top.ops).toBe(1); // only billable operations
    const o = await overview(admin);
    expect(o.users).toBeGreaterThanOrEqual(4);
    const e = await errorsReport(support);
    expect(e.failedAi.some((f) => f.feature === "quiz")).toBe(true);
  });
});
