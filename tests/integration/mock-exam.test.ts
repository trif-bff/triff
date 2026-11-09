import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { evidence, quizQuestions, subjects, user } from "@/db/schema";
import { ingestDocument } from "@/lib/services/documents";
import { createMockExam, ExamError, getMockResult, mockHistory, submitMock } from "@/lib/services/exams";

const userId = `test-${randomUUID()}`;
const otherId = `test-${randomUUID()}`;
let subjectId: string;

beforeAll(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await db.insert(user).values([
    { id: userId, name: "Ana", email: `${userId}@example.com` },
    { id: otherId, name: "Otro", email: `${otherId}@example.com` },
  ]);
  [{ id: subjectId }] = await db.insert(subjects).values({ userId, name: "Contabilidad", targetGrade: 7 }).returning({ id: subjects.id });
  await ingestDocument({ userId, subjectId, filename: "contabilidad.md", declaredType: "text/markdown", bytes: new Uint8Array(readFileSync(new URL("../fixtures/contabilidad.md", import.meta.url))) });
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
  await db.delete(user).where(eq(user.id, otherId));
  await pool.end();
});

async function answerAllCorrect(quizId: string) {
  const qs = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quizId));
  return qs.map((q) => ({ questionId: q.id, selected: q.correct }));
}

describe("mock exams", () => {
  let first: string;

  it("refuses subjects without notes and foreign subjects", async () => {
    const [{ id: empty }] = await db.insert(subjects).values({ userId, name: "Vacía" }).returning({ id: subjects.id });
    await expect(createMockExam(userId, empty, { questions: 10, minutes: 10 })).rejects.toThrow(/Sube apuntes/);
    await expect(createMockExam(otherId, subjectId, { questions: 10, minutes: 10 })).rejects.toBeInstanceOf(ExamError);
  });

  it("creates a timed mock covering the syllabus", async () => {
    const r = await createMockExam(userId, subjectId, { questions: 10, minutes: 20 });
    first = r.quizId;
    expect(r.questions).toBe(10);
    const qs = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, first));
    expect(new Set(qs.map((q) => q.topicId)).size).toBe(3);
  });

  it("grades once, records evidence and rejects a second submission", async () => {
    const answers = await answerAllCorrect(first);
    answers[0] = { ...answers[0], selected: [] }; // one unanswered
    const res = await submitMock(userId, first, answers);
    expect(res.report.grade).toBe(9);
    expect(res.report.answered).toBe(9);
    expect(res.report.late).toBe(false);
    expect(res.report.trend.previous).toBeNull();
    const ev = await db.select().from(evidence).where(eq(evidence.userId, userId));
    expect(ev).toHaveLength(9); // unanswered items are not evidence
    await expect(submitMock(userId, first, answers)).rejects.toThrow(/ya se entregó/);
  });

  it("rebuilds the same report on reload and isolates users", async () => {
    const again = await getMockResult(userId, first);
    expect(again?.report.grade).toBe(9);
    expect(await getMockResult(otherId, first)).toBeNull();
    await expect(submitMock(otherId, first, [])).rejects.toThrow(/no encontrado/);
  });

  it("flags late submissions using the server clock and compares with the previous mock", async () => {
    const { quizId } = await createMockExam(userId, subjectId, { questions: 10, minutes: 5 });
    await db.execute(sql`update quizzes set started_at = now() - interval '7 minutes' where id = ${quizId}`);
    const res = await submitMock(userId, quizId, []);
    expect(res.report.late).toBe(true);
    expect(res.report.grade).toBe(0);
    expect(res.report.trend).toEqual({ previous: 9, delta: -9 });
    const hist = await mockHistory(userId, subjectId);
    expect(hist.map((h) => h.late)).toEqual([true, false]);
    expect(hist[0].title).toMatch(/^Simulacro 2/);
  });

  it("keeps practice quizzes and mocks separate", async () => {
    const rows = await db.execute<{ n: number }>(sql`select count(*)::int as n from quizzes where subject_id = ${subjectId} and kind = 'practice'`);
    expect(rows.rows[0].n).toBe(0);
    expect((await db.select().from(evidence).where(and(eq(evidence.userId, otherId)))).length).toBe(0);
  });
});
