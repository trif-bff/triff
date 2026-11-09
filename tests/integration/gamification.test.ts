import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { dailyChallenges, quizQuestions, subjects, topics, user, userBadges, xpEvents } from "@/db/schema";
import { DAILY_ACTIVITY_CAP, XP } from "@/lib/learning/gamification";
import { ingestDocument } from "@/lib/services/documents";
import { createMockExam, submitMock } from "@/lib/services/exams";
import {
  challengesWithProgress,
  ensureChallenges,
  finish,
  gamificationEnabled,
  gamificationSummary,
  grantXp,
  recordLearning,
  setGamification,
  totalXp,
} from "@/lib/services/gamification";
import { generateFlashcards } from "@/lib/services/generation";

const userId = `test-${randomUUID()}`;
let subjectId: string;
let amortId: string;

beforeAll(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await db.insert(user).values({ id: userId, name: "Ana", email: `${userId}@example.com` });
  [{ id: subjectId }] = await db.insert(subjects).values({ userId, name: "Contabilidad" }).returning({ id: subjects.id });
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
  await pool.end();
});

describe("gamification", () => {
  it("offers an upload challenge before there are notes, and completes it on upload", async () => {
    const before = await ensureChallenges(userId);
    expect(before[0].kind).toBe("upload");
    const doc = await ingestDocument({ userId, subjectId, filename: "c.md", declaredType: "text/markdown", bytes: new Uint8Array(readFileSync(new URL("../fixtures/contabilidad.md", import.meta.url))) });
    await grantXp(userId, { kind: "document", amount: XP.documentUploaded, key: `doc:${doc.id}` });
    const r = await finish(userId);
    expect(r.challengesCompleted).toContain("Sube los apuntes de una asignatura");
    expect(r.badges.map((b) => b.id)).toContain("first_upload");
    [{ id: amortId }] = await db.select({ id: topics.id }).from(topics).where(and(eq(topics.subjectId, subjectId), eq(topics.normalizedTitle, "la amortizacion")));
  });

  it("keeps today's challenges stable once created", async () => {
    const a = await ensureChallenges(userId);
    await generateFlashcards({ id: userId, role: "student" }, subjectId, {});
    const b = await ensureChallenges(userId);
    expect(b.map((c) => c.id)).toEqual(a.map((c) => c.id));
  });

  it("is idempotent: a badge or achievement key pays only once", async () => {
    expect(await grantXp(userId, { kind: "badge", amount: 50, key: "badge:test" })).toBe(50);
    expect(await grantXp(userId, { kind: "badge", amount: 50, key: "badge:test" })).toBe(0);
    await finish(userId);
    const badges = await db.select().from(userBadges).where(eq(userBadges.userId, userId));
    expect(badges.filter((b) => b.badge === "first_upload")).toHaveLength(1);
  });

  it("caps daily activity XP so grinding does not pay", async () => {
    let granted = 0;
    for (let i = 0; i < 100; i++) granted += await grantXp(userId, { kind: "review", amount: XP.review });
    const rows = await db.execute<{ n: number }>(sql`select coalesce(sum(amount),0)::int as n from xp_events where user_id = ${userId} and kind in ('review','answer','document')`);
    expect(rows.rows[0].n).toBe(DAILY_ACTIVITY_CAP);
    expect(granted).toBeLessThan(100 * XP.review);
  });

  it("rewards real improvement once per mastery level, and gap recovery", async () => {
    const fail = Array.from({ length: 4 }, () => ({ userId, subjectId, topicId: amortId, kind: "flashcard", score: 0 }));
    await recordLearning(userId, subjectId, fail); // creates a consolidated gap
    const win = [
      ...Array.from({ length: 6 }, () => ({ userId, subjectId, topicId: amortId, kind: "flashcard", score: 1 })),
      ...Array.from({ length: 6 }, () => ({ userId, subjectId, topicId: amortId, kind: "exercise", score: 1 })),
    ];
    await recordLearning(userId, subjectId, win);
    const kinds = (await db.select().from(xpEvents).where(eq(xpEvents.userId, userId))).filter((e) => (e.meta as { topicId?: string }).topicId === amortId).map((e) => e.key).sort();
    expect(kinds).toContain(`gap:${amortId}`);
    expect(kinds).toContain(`level:${amortId}:developing`);
    // Falling and recovering again does not pay twice.
    const xpBefore = await totalXp(userId);
    await recordLearning(userId, subjectId, fail);
    await recordLearning(userId, subjectId, win);
    const repeated = (await db.select().from(xpEvents).where(and(eq(xpEvents.userId, userId), eq(xpEvents.key, `level:${amortId}:developing`))));
    expect(repeated).toHaveLength(1);
    expect(await totalXp(userId)).toBeGreaterThanOrEqual(xpBefore);
  });

  it("rewards completing a mock and improving on the previous one", async () => {
    const a = await createMockExam(userId, subjectId, { questions: 6, minutes: 10 });
    const r1 = await submitMock(userId, a.quizId, []);
    expect(r1.rewards?.badges.map((b) => b.id)).toContain("first_mock");
    const b = await createMockExam(userId, subjectId, { questions: 6, minutes: 10 });
    const qs = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, b.quizId));
    const r2 = await submitMock(userId, b.quizId, qs.map((q) => ({ questionId: q.id, selected: q.correct })));
    expect(r2.report.trend.delta).toBeGreaterThan(0);
    expect(r2.rewards?.badges.map((x) => x.id)).toContain("mock_improved");
    const imp = await db.select().from(xpEvents).where(and(eq(xpEvents.userId, userId), eq(xpEvents.kind, "mock_improvement")));
    expect(imp[0].amount).toBe(Math.round(r2.report.trend.delta! * XP.mockImprovementPerPoint));
  });

  it("summarises level, streak and challenges, and can be hidden", async () => {
    const s = await gamificationSummary(userId);
    expect(s.xp).toBeGreaterThan(0);
    expect(s.level.level).toBeGreaterThanOrEqual(2);
    expect(s.streak.streak).toBe(1);
    expect((await challengesWithProgress(userId)).length).toBe((await db.select().from(dailyChallenges).where(eq(dailyChallenges.userId, userId))).length);
    await setGamification(userId, false);
    expect(await gamificationEnabled(userId)).toBe(false);
    await setGamification(userId, true);
    expect(await gamificationEnabled(userId)).toBe(true);
  });
});
