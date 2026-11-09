import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { quizAttempts, quizQuestions, quizzes } from "@/db/schema";
import { guard, isResponse, jsonError } from "@/lib/http";
import { gradeAnswer } from "@/lib/learning/grading";
import { ExamError, submitMock } from "@/lib/services/exams";
import { recordEvidence, regeneratePlan } from "@/lib/services/progress";

const body = z.object({
  answers: z.array(z.object({ questionId: z.uuid(), selected: z.array(z.number().int().min(0).max(10)).max(10) })).max(50),
  durationMs: z.number().int().min(0).max(4 * 3600_000).default(0),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guard(req, { limit: 20 });
  if (isResponse(user)) return user;
  const { id } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Respuestas no válidas");

  const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.userId, user.id)));
  if (!quiz) return jsonError("Cuestionario no encontrado", 404);
  if (quiz.kind === "mock") {
    try {
      return NextResponse.json(await submitMock(user.id, id, parsed.data.answers));
    } catch (e) {
      if (e instanceof ExamError) return jsonError(e.message, e.status);
      throw e;
    }
  }
  const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, id)).orderBy(asc(quizQuestions.ordinal));

  const given = new Map(parsed.data.answers.map((a) => [a.questionId, a.selected]));
  const perQuestionMs = questions.length ? Math.round(parsed.data.durationMs / questions.length) : 0;
  const results = questions.map((q) => {
    const selected = given.get(q.id) ?? [];
    const score = gradeAnswer(q.correct, selected);
    return { questionId: q.id, selected, correct: score === 1, score, correctOptions: q.correct, explanation: q.explanation, topicId: q.topicId, type: q.type };
  });

  const score = results.filter((r) => r.correct).length;
  await db.insert(quizAttempts).values({
    quizId: id,
    userId: user.id,
    score,
    total: questions.length,
    durationMs: parsed.data.durationMs,
    answers: results.map(({ questionId, selected, correct }) => ({ questionId, selected, correct })),
  });
  // Unanswered questions are not evidence of anything — skip them.
  await recordEvidence(
    results
      .filter((r) => r.selected.length > 0)
      .map((r) => ({ userId: user.id, subjectId: quiz.subjectId, topicId: r.topicId, kind: r.type, score: r.score, durationMs: perQuestionMs })),
  );
  await regeneratePlan(user.id, quiz.subjectId);

  return NextResponse.json({
    score,
    total: questions.length,
    results: results.map(({ questionId, correct, correctOptions, explanation }) => ({ questionId, correct, correctOptions, explanation })),
  });
}
