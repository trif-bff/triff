import "server-only";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quizAttempts, quizQuestions, quizzes, subjects, topics } from "@/db/schema";
import { buildExamReport, type ExamReport } from "@/lib/learning/exam-report";
import { gradeAnswer } from "@/lib/learning/grading";
import { extractDefinitions, mockExamFromDefinitions, type SourceChunk } from "@/lib/learning/heuristic";
import { loadChunks } from "./generation";
import { XP } from "@/lib/learning/gamification";
import { grantXp, recordLearning, type Rewards } from "./gamification";
import { regeneratePlan } from "./progress";

export const MOCK_LIMITS = { minQuestions: 5, maxQuestions: 40, minMinutes: 5, maxMinutes: 180 };

export class ExamError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/**
 * Creates a timed mock exam from the student's notes. The clock starts on the
 * server at creation (`startedAt`), so the client cannot extend the time.
 * AI-generated open questions with rubrics arrive when a provider is configured (Phase 10.5).
 */
export async function createMockExam(userId: string, subjectId: string, opts: { questions: number; minutes: number }) {
  const [subject] = await db.select().from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
  if (!subject) throw new ExamError("Asignatura no encontrada", 404);

  const rows = await loadChunks(userId, subjectId);
  if (rows.length === 0) throw new ExamError("Sube apuntes antes de hacer un simulacro.", 422);
  const ts = await db.select({ id: topics.id, importance: topics.importance }).from(topics).where(eq(topics.subjectId, subjectId));
  const defs = extractDefinitions(rows as SourceChunk[]);
  const qs = mockExamFromDefinitions(defs, ts, opts.questions, Date.now() % 100000);
  if (qs.length < MOCK_LIMITS.minQuestions)
    throw new ExamError(`Tus apuntes solo permiten ${qs.length} preguntas sin IA; hacen falta al menos ${MOCK_LIMITS.minQuestions} para un simulacro.`, 422);

  const [{ n: done }] = await db.select({ n: count() }).from(quizzes).where(and(eq(quizzes.subjectId, subjectId), eq(quizzes.kind, "mock")));
  const n = done + 1;
  const [quiz] = await db
    .insert(quizzes)
    .values({
      userId,
      subjectId,
      title: `Simulacro ${n} · ${subject.name}`,
      origin: "heuristic",
      kind: "mock",
      timeLimitSec: opts.minutes * 60,
      startedAt: new Date(),
    })
    .returning({ id: quizzes.id });
  await db.insert(quizQuestions).values(
    qs.map((q, i) => ({ quizId: quiz.id, topicId: q.topicId, sourceChunkId: q.chunkId, ordinal: i, type: q.type, prompt: q.prompt, options: q.options, correct: q.correct, explanation: q.explanation })),
  );
  return { quizId: quiz.id, questions: qs.length };
}

async function loadMock(userId: string, quizId: string) {
  const [quiz] = await db
    .select({ quiz: quizzes, targetGrade: subjects.targetGrade })
    .from(quizzes)
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId), eq(quizzes.kind, "mock")));
  if (!quiz) return null;
  const questions = await db
    .select({ q: quizQuestions, topicTitle: topics.title })
    .from(quizQuestions)
    .leftJoin(topics, eq(topics.id, quizQuestions.topicId))
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.ordinal));
  return { ...quiz, questions };
}

async function previousMockGrades(userId: string, subjectId: string, before: Date) {
  const rows = await db
    .select({ score: quizAttempts.score, total: quizAttempts.total, answers: quizAttempts.answers, createdAt: quizAttempts.createdAt })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .where(and(eq(quizAttempts.userId, userId), eq(quizzes.subjectId, subjectId), eq(quizzes.kind, "mock")))
    .orderBy(desc(quizAttempts.createdAt));
  return rows.filter((r) => r.createdAt < before).map((r) => (r.total ? Math.round((r.score / r.total) * 100) / 10 : 0));
}

export type MockResult = {
  report: ExamReport;
  rewards?: Rewards;
  results: { questionId: string; correct: boolean; selected: number[]; correctOptions: number[]; explanation: string }[];
};

function scoreAnswers(mock: NonNullable<Awaited<ReturnType<typeof loadMock>>>, given: Map<string, number[]>) {
  return mock.questions.map(({ q, topicTitle }) => {
    const selected = given.get(q.id) ?? [];
    const score = gradeAnswer(q.correct, selected);
    return { q, topicTitle, selected, score };
  });
}

/** One attempt per mock (a real exam is not retaken). Late submissions are graded and flagged. */
export async function submitMock(userId: string, quizId: string, answers: { questionId: string; selected: number[] }[]): Promise<MockResult> {
  const mock = await loadMock(userId, quizId);
  if (!mock) throw new ExamError("Simulacro no encontrado", 404);
  const [done] = await db.select({ id: quizAttempts.id }).from(quizAttempts).where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId)));
  if (done) throw new ExamError("Este simulacro ya se entregó.", 409);

  const submittedAt = new Date();
  const startedAt = mock.quiz.startedAt ?? mock.quiz.createdAt;
  const limitSec = mock.quiz.timeLimitSec ?? 0;
  const scored = scoreAnswers(mock, new Map(answers.map((a) => [a.questionId, a.selected])));
  const report = buildExamReport({
    items: scored.map((s) => ({ topicId: s.q.topicId, topicTitle: s.topicTitle, score: s.score, answered: s.selected.length > 0 })),
    previousGrades: await previousMockGrades(userId, mock.quiz.subjectId, submittedAt),
    startedAt,
    submittedAt,
    limitSec,
    targetGrade: mock.targetGrade,
  });

  await db.insert(quizAttempts).values({
    quizId,
    userId,
    score: scored.filter((s) => s.score === 1).length,
    total: scored.length,
    durationMs: submittedAt.getTime() - startedAt.getTime(),
    late: report.late,
    answers: scored.map((s) => ({ questionId: s.q.id, selected: s.selected, correct: s.score === 1 })),
  });
  const perItemMs = scored.length ? Math.round(Math.min(report.usedSec, limitSec) * 1000 / scored.length) : 0;
  let xp = await grantXp(userId, { kind: "mock_completed", amount: XP.mockCompleted, key: `mock:${quizId}` });
  if (report.trend.delta !== null && report.trend.delta > 0) {
    xp += await grantXp(userId, { kind: "mock_improvement", amount: Math.round(report.trend.delta * XP.mockImprovementPerPoint), key: `mockimp:${quizId}`, meta: { delta: report.trend.delta } });
  }
  const rewards = await recordLearning(
    userId,
    mock.quiz.subjectId,
    scored
      .filter((s) => s.selected.length > 0)
      .map((s) => ({ userId, subjectId: mock.quiz.subjectId, topicId: s.q.topicId, kind: s.q.type, score: s.score, durationMs: perItemMs })),
  );
  await regeneratePlan(userId, mock.quiz.subjectId);
  return { report, results: toResults(scored), rewards: { ...rewards, xp: rewards.xp + xp } };
}

function toResults(scored: ReturnType<typeof scoreAnswers>) {
  return scored.map((s) => ({ questionId: s.q.id, correct: s.score === 1, selected: s.selected, correctOptions: s.q.correct, explanation: s.q.explanation }));
}

/** Rebuilds the report of an already submitted mock (e.g. on page reload). */
export async function getMockResult(userId: string, quizId: string): Promise<MockResult | null> {
  const mock = await loadMock(userId, quizId);
  if (!mock) return null;
  const [attempt] = await db.select().from(quizAttempts).where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId)));
  if (!attempt) return null;
  const scored = scoreAnswers(mock, new Map(attempt.answers.map((a) => [a.questionId, a.selected])));
  const startedAt = mock.quiz.startedAt ?? mock.quiz.createdAt;
  const report = buildExamReport({
    items: scored.map((s) => ({ topicId: s.q.topicId, topicTitle: s.topicTitle, score: s.score, answered: s.selected.length > 0 })),
    previousGrades: await previousMockGrades(userId, mock.quiz.subjectId, attempt.createdAt),
    startedAt,
    submittedAt: new Date(startedAt.getTime() + attempt.durationMs),
    limitSec: mock.quiz.timeLimitSec ?? 0,
    targetGrade: mock.targetGrade,
  });
  return { report, results: toResults(scored) };
}

export async function mockHistory(userId: string, subjectId: string) {
  const rows = await db
    .select({ id: quizzes.id, title: quizzes.title, createdAt: quizzes.createdAt, score: quizAttempts.score, total: quizAttempts.total, late: quizAttempts.late })
    .from(quizzes)
    .leftJoin(quizAttempts, eq(quizAttempts.quizId, quizzes.id))
    .where(and(eq(quizzes.userId, userId), eq(quizzes.subjectId, subjectId), eq(quizzes.kind, "mock")))
    .orderBy(desc(quizzes.createdAt))
    .limit(10);
  return rows.map((r) => ({ ...r, grade: r.total ? Math.round(((r.score ?? 0) / r.total) * 100) / 10 : null }));
}
