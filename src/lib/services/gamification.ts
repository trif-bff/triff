import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gte, inArray, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { dailyChallenges, documents, planItems, reviewLogs, subjects, userBadges, userSettings, xpEvents } from "@/db/schema";
import {
  ACTIVITY_KINDS,
  BADGES,
  capActivityXp,
  challengeProgress,
  computeStreak,
  earnedBadges,
  levelFromXp,
  pickChallenges,
  transitionRewards,
  XP,
  type BadgeId,
  type ChallengeKind,
  type Transition,
} from "@/lib/learning/gamification";
import { activeDays, dueCards, overallMastery, recordEvidence, STUDY_TZ, todayIso, topicMastery } from "./progress";

type EvidenceRow = Parameters<typeof recordEvidence>[0][number];

/* --------------------------------- XP ledger ------------------------------- */

async function activityXpToday(userId: string) {
  const [r] = await db
    .select({ n: sum(xpEvents.amount) })
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, userId), inArray(xpEvents.kind, [...ACTIVITY_KINDS]), sql`(${xpEvents.createdAt} at time zone ${STUDY_TZ})::date = ${todayIso()}::date`));
  return Number(r?.n ?? 0);
}

/** Grants XP once per key. Activity kinds respect the daily cap. Returns the XP actually granted. */
export async function grantXp(userId: string, e: { kind: string; amount: number; key?: string; meta?: Record<string, unknown> }) {
  let amount = e.amount;
  if (ACTIVITY_KINDS.has(e.kind)) amount = capActivityXp(amount, await activityXpToday(userId));
  if (amount <= 0) return 0;
  const inserted = await db
    .insert(xpEvents)
    .values({ userId, kind: e.kind, amount, key: e.key ?? `${e.kind}:${randomUUID()}`, meta: e.meta ?? {} })
    .onConflictDoNothing()
    .returning({ amount: xpEvents.amount });
  return inserted[0]?.amount ?? 0;
}

export type Rewards = { xp: number; badges: { id: BadgeId; name: string }[]; challengesCompleted: string[] };

/**
 * Records learning evidence and rewards it: activity XP for answered items,
 * improvement XP for mastery transitions (once per level per topic), then
 * daily challenges and badges.
 */
export async function recordLearning(userId: string, subjectId: string, rows: EvidenceRow[]): Promise<Rewards> {
  const before = await topicMastery(userId, subjectId);
  await recordEvidence(rows);
  const after = await topicMastery(userId, subjectId);

  let xp = 0;
  for (const r of rows) {
    if (r.kind === "mcq" || r.kind === "true_false") {
      xp += await grantXp(userId, { kind: "answer", amount: XP.answer + (r.score === 1 ? XP.correct : 0) });
    }
  }
  const prev = new Map(before.map((t) => [t.id, t]));
  const transitions: Transition[] = after
    .filter((t) => prev.has(t.id))
    .map((t) => ({ topicId: t.id, from: prev.get(t.id)!.estimate.level, to: t.estimate.level, gapBefore: prev.get(t.id)!.estimate.isGap, gapAfter: t.estimate.isGap }));
  for (const r of transitionRewards(transitions)) {
    xp += await grantXp(userId, { kind: r.kind, amount: r.amount, key: r.key, meta: { topicId: r.topicId } });
  }
  return finish(userId, xp);
}

/** Rewards that do not come with evidence (reviews are rewarded by their route, uploads, mocks). */
export async function finish(userId: string, xp = 0): Promise<Rewards> {
  const ch = await checkChallenges(userId);
  const badges = await evaluateBadges(userId);
  return { xp: xp + ch.xp + badges.xp, badges: badges.earned, challengesCompleted: ch.completed };
}

/* ------------------------------ Daily challenges --------------------------- */

async function weakestTopic(userId: string) {
  const ss = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.userId, userId));
  let best: { id: string; title: string; score: number } | null = null;
  for (const s of ss) {
    for (const t of await topicMastery(userId, s.id)) {
      // Started topics rank by mastery; untouched ones by importance (as a lower priority).
      const score = t.estimate.level === "not_started" ? 1 - t.importance * 0.01 : t.estimate.p;
      if (!best || score < best.score) best = { id: t.id, title: t.title, score };
    }
  }
  return best && { id: best.id, title: best.title };
}

async function todaysPlanTopics(userId: string) {
  const rows = await db
    .select({ topicId: planItems.topicId })
    .from(planItems)
    .where(and(eq(planItems.userId, userId), eq(planItems.day, todayIso())));
  return [...new Set(rows.map((r) => r.topicId).filter((x): x is string => Boolean(x)))];
}

/** Today's challenges are fixed the first time they are requested (stable during the day). */
export async function ensureChallenges(userId: string) {
  const day = todayIso();
  const existing = await db.select().from(dailyChallenges).where(and(eq(dailyChallenges.userId, userId), eq(dailyChallenges.day, day))).orderBy(asc(dailyChallenges.slot));
  if (existing.length) return existing;
  const [{ n: docs }] = await db.select({ n: count() }).from(documents).where(and(eq(documents.userId, userId), eq(documents.status, "ready")));
  const specs = pickChallenges({
    dueCards: await dueCards(userId),
    hasDocuments: docs > 0,
    weakestTopic: await weakestTopic(userId),
    planTopics: await todaysPlanTopics(userId),
  });
  if (specs.length) {
    await db
      .insert(dailyChallenges)
      .values(specs.map((c) => ({ userId, day, slot: c.slot, kind: c.kind, title: c.title, target: c.target, topicId: c.topicId })))
      .onConflictDoNothing();
  }
  return db.select().from(dailyChallenges).where(and(eq(dailyChallenges.userId, userId), eq(dailyChallenges.day, day))).orderBy(asc(dailyChallenges.slot));
}

async function todaysEvidence(userId: string) {
  const rows = await db.execute<{ topic_id: string | null; kind: string; score: number }>(sql`
    select topic_id, kind, score from evidence
    where user_id = ${userId} and (created_at at time zone ${STUDY_TZ})::date = ${todayIso()}::date`);
  const uploads = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from documents
    where user_id = ${userId} and status = 'ready' and (created_at at time zone ${STUDY_TZ})::date = ${todayIso()}::date`);
  return { ev: rows.rows.map((r) => ({ topicId: r.topic_id, kind: r.kind, score: Number(r.score) })), uploads: uploads.rows[0]?.n ?? 0 };
}

export async function challengesWithProgress(userId: string) {
  const list = await ensureChallenges(userId);
  const { ev, uploads } = await todaysEvidence(userId);
  const plan = await todaysPlanTopics(userId);
  return list.map((c) => {
    const progress = challengeProgress({ slot: c.slot, kind: c.kind as ChallengeKind, target: c.target, topicId: c.topicId, title: c.title }, ev, uploads, plan);
    return { ...c, progress, done: Boolean(c.completedAt) || progress >= c.target };
  });
}

async function checkChallenges(userId: string) {
  const list = await challengesWithProgress(userId);
  let xp = 0;
  const completed: string[] = [];
  for (const c of list) {
    if (c.done && !c.completedAt) {
      await db.update(dailyChallenges).set({ completedAt: new Date() }).where(eq(dailyChallenges.id, c.id));
      const g = await grantXp(userId, { kind: "challenge", amount: XP.challenge, key: `challenge:${c.id}` });
      if (g) completed.push(c.title);
      xp += g;
    }
  }
  if (list.length > 0 && list.every((c) => c.done)) {
    xp += await grantXp(userId, { kind: "all_challenges", amount: XP.allChallenges, key: `challenges:${todayIso()}` });
  }
  return { xp, completed };
}

/* ----------------------------------- Badges -------------------------------- */

async function badgeStats(userId: string) {
  const today = todayIso();
  const kinds = await db
    .select({ kind: xpEvents.kind, n: count() })
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, userId), inArray(xpEvents.kind, ["mastered", "gap_recovered", "mock_improvement", "mock_completed"])))
    .groupBy(xpEvents.kind);
  const k = new Map(kinds.map((r) => [r.kind, r.n]));
  const [{ n: docs }] = await db.select({ n: count() }).from(documents).where(and(eq(documents.userId, userId), eq(documents.status, "ready")));
  const [{ n: reviews }] = await db.select({ n: count() }).from(reviewLogs).where(eq(reviewLogs.userId, userId));
  const coverage = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from subjects s
    where s.user_id = ${userId}
      and exists (select 1 from topics t where t.subject_id = s.id)
      and not exists (
        select 1 from topics t where t.subject_id = s.id
          and not exists (select 1 from evidence e where e.topic_id = t.id and e.user_id = ${userId}))`);
  let examReady = false;
  const upcoming = await db.select().from(subjects).where(and(eq(subjects.userId, userId), gte(subjects.examDate, today)));
  for (const s of upcoming) {
    if (!s.targetGrade) continue;
    const tm = await topicMastery(userId, s.id);
    if (tm.length && overallMastery(tm) >= s.targetGrade / 10) examReady = true;
  }
  return {
    documents: docs,
    mocks: k.get("mock_completed") ?? 0,
    mockImproved: (k.get("mock_improvement") ?? 0) > 0,
    topicsMastered: k.get("mastered") ?? 0,
    gapsRecovered: k.get("gap_recovered") ?? 0,
    streak: computeStreak(new Set((await activeDays(userId)).keys()), today).streak,
    reviews,
    fullCoverage: (coverage.rows[0]?.n ?? 0) > 0,
    examReady,
  };
}

async function evaluateBadges(userId: string) {
  const ids = earnedBadges(await badgeStats(userId));
  if (ids.length === 0) return { xp: 0, earned: [] as { id: BadgeId; name: string }[] };
  const inserted = await db
    .insert(userBadges)
    .values(ids.map((badge) => ({ userId, badge })))
    .onConflictDoNothing()
    .returning({ badge: userBadges.badge });
  let xp = 0;
  for (const b of inserted) xp += await grantXp(userId, { kind: "badge", amount: XP.badge, key: `badge:${b.badge}` });
  return { xp, earned: inserted.map((b) => ({ id: b.badge as BadgeId, name: BADGES[b.badge as BadgeId].name })) };
}

/* ---------------------------------- Read model ----------------------------- */

export async function gamificationEnabled(userId: string) {
  const [s] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  return s?.gamification ?? true;
}

export async function setGamification(userId: string, enabled: boolean) {
  await db
    .insert(userSettings)
    .values({ userId, gamification: enabled })
    .onConflictDoUpdate({ target: userSettings.userId, set: { gamification: enabled, updatedAt: new Date() } });
}

export async function totalXp(userId: string) {
  const [r] = await db.select({ n: sum(xpEvents.amount) }).from(xpEvents).where(eq(xpEvents.userId, userId));
  return Number(r?.n ?? 0);
}

export async function gamificationSummary(userId: string) {
  const [enabled, xp, days, challenges, badges] = await Promise.all([
    gamificationEnabled(userId),
    totalXp(userId),
    activeDays(userId, 120),
    challengesWithProgress(userId),
    db.select().from(userBadges).where(eq(userBadges.userId, userId)),
  ]);
  const xpToday = await db.execute<{ n: number }>(sql`
    select coalesce(sum(amount), 0)::int as n from xp_events
    where user_id = ${userId} and (created_at at time zone ${STUDY_TZ})::date = ${todayIso()}::date`);
  return {
    enabled,
    xp,
    xpToday: xpToday.rows[0]?.n ?? 0,
    level: levelFromXp(xp),
    streak: computeStreak(new Set(days.keys()), todayIso()),
    activity: days,
    challenges,
    badges: new Map(badges.map((b) => [b.badge as BadgeId, b.earnedAt])),
  };
}
