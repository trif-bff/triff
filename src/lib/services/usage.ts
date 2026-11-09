import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { getSettings } from "./settings";

/** Daily AI-operation allowance per plan, configurable from the admin panel. */
export async function dailyLimit(user: { role: string; plan?: string }) {
  if (user.role === "admin") return Number.POSITIVE_INFINITY;
  const s = await getSettings();
  return user.plan === "premium" ? s.plans.premium.aiDailyLimit : s.plans.free.aiDailyLimit;
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function usedToday(userId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.billable, true), gte(aiUsage.createdAt, startOfDay())));
  return r?.n ?? 0;
}

export async function assertQuota(user: { id: string; role: string; plan?: string }) {
  const used = await usedToday(user.id);
  const limit = await dailyLimit(user);
  if (used >= limit) {
    const e = new Error(`Has alcanzado el límite diario de ${limit} operaciones de IA.`);
    (e as Error & { status?: number }).status = 429;
    throw e;
  }
  return { used, limit };
}

/** Failed operations are logged for cost control but never counted against the student. */
export async function logUsage(row: {
  userId: string;
  feature: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  success: boolean;
}) {
  await db.insert(aiUsage).values({ ...row, billable: row.success });
}

/** Simple per-process sliding-window limiter. Replace with Redis in multi-instance deployments. */
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  hits.set(key, arr);
  return true;
}
