import "server-only";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { evidence, flashcards, planItems, subjects, topics } from "@/db/schema";
import { decideNextStep, estimateMastery, type MasteryEstimate, type NextStep } from "@/lib/learning/mastery";
import { buildPlan } from "@/lib/learning/planner";

export async function recordEvidence(rows: {
  userId: string;
  subjectId: string;
  topicId: string | null;
  kind: string;
  score: number;
  durationMs?: number;
}[]) {
  if (rows.length) await db.insert(evidence).values(rows.map((r) => ({ ...r, durationMs: r.durationMs ?? 0 })));
}

export type TopicMastery = {
  id: string;
  title: string;
  importance: number;
  estimate: MasteryEstimate;
  next: NextStep;
};

export async function topicMastery(userId: string, subjectId: string): Promise<TopicMastery[]> {
  const ts = await db.select().from(topics).where(eq(topics.subjectId, subjectId)).orderBy(asc(topics.ordinal));
  const ev = await db
    .select({ topicId: evidence.topicId, kind: evidence.kind, score: evidence.score, createdAt: evidence.createdAt })
    .from(evidence)
    .where(and(eq(evidence.userId, userId), eq(evidence.subjectId, subjectId)))
    .orderBy(asc(evidence.createdAt));
  const byTopic = new Map<string, typeof ev>();
  for (const e of ev) if (e.topicId) byTopic.set(e.topicId, [...(byTopic.get(e.topicId) ?? []), e]);
  return ts.map((t) => {
    const list = byTopic.get(t.id) ?? [];
    const estimate = estimateMastery(list);
    return { id: t.id, title: t.title, importance: t.importance, estimate, next: decideNextStep(estimate, list.map((e) => e.score)) };
  });
}

/** Importance-weighted average of topic mastery (0..1). */
export function overallMastery(tm: TopicMastery[]) {
  const w = tm.reduce((a, t) => a + t.importance, 0);
  if (!w) return 0;
  return tm.reduce((a, t) => a + t.importance * t.estimate.p * (t.estimate.level === "not_started" ? 0 : 1), 0) / w;
}

export function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export async function regeneratePlan(userId: string, subjectId: string) {
  const [s] = await db.select().from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
  if (!s) return 0;
  const tm = await topicMastery(userId, subjectId);
  const today = todayIso();
  const items = buildPlan({
    today,
    examDate: s.examDate,
    minutesPerDay: s.minutesPerDay,
    topics: tm.map((t) => ({ id: t.id, title: t.title, importance: t.importance, mastery: t.estimate.p * (t.estimate.level === "not_started" ? 0 : 1), isGap: t.estimate.isGap })),
  });
  await db.transaction(async (tx) => {
    await tx.delete(planItems).where(and(eq(planItems.subjectId, subjectId), gte(planItems.day, today), eq(planItems.done, false)));
    if (items.length) await tx.insert(planItems).values(items.map((i) => ({ ...i, userId, subjectId })));
  });
  return items.length;
}

/** Consecutive days (ending today or yesterday) with at least one piece of learning evidence. */
export async function streak(userId: string) {
  const rows = await db.execute<{ day: string }>(sql`
    select distinct to_char(created_at at time zone 'Europe/Madrid', 'YYYY-MM-DD') as day
    from evidence where user_id = ${userId} and created_at > now() - interval '400 days'
    order by day desc`);
  const days = new Set(rows.rows.map((r) => r.day));
  let n = 0;
  const d = new Date(`${todayIso()}T12:00:00Z`);
  if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

export async function studyMinutesThisWeek(userId: string) {
  const r = await db.execute<{ ms: string | null }>(sql`
    select sum(duration_ms) as ms from evidence where user_id = ${userId} and created_at > now() - interval '7 days'`);
  return Math.round(Number(r.rows[0]?.ms ?? 0) / 60000);
}

export async function dueCards(userId: string, subjectId?: string) {
  const conds = [eq(flashcards.userId, userId), lte(flashcards.due, new Date())];
  if (subjectId) conds.push(eq(flashcards.subjectId, subjectId));
  const [r] = await db.select({ n: count() }).from(flashcards).where(and(...conds));
  return r?.n ?? 0;
}

export async function todaysPlan(userId: string) {
  return db
    .select({
      id: planItems.id,
      activity: planItems.activity,
      minutes: planItems.minutes,
      reason: planItems.reason,
      done: planItems.done,
      subjectId: planItems.subjectId,
      subjectName: subjects.name,
      topicId: planItems.topicId,
      topicTitle: topics.title,
    })
    .from(planItems)
    .innerJoin(subjects, eq(subjects.id, planItems.subjectId))
    .leftJoin(topics, eq(topics.id, planItems.topicId))
    .where(and(eq(planItems.userId, userId), eq(planItems.day, todayIso())))
    .orderBy(asc(planItems.done), desc(planItems.minutes));
}
