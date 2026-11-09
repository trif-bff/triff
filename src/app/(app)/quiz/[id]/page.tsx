import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { quizAttempts, quizQuestions, quizzes, subjects } from "@/db/schema";
import { QuizRunner } from "@/components/quiz-runner";
import { getMockResult } from "@/lib/services/exams";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Cuestionario" };

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [quiz] = await db
    .select({ id: quizzes.id, title: quizzes.title, origin: quizzes.origin, subjectId: quizzes.subjectId, subject: subjects.name, kind: quizzes.kind, startedAt: quizzes.startedAt, timeLimitSec: quizzes.timeLimitSec })
    .from(quizzes)
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .where(and(eq(quizzes.id, id), eq(quizzes.userId, user.id)));
  if (!quiz) notFound();
  // Correct answers and explanations are NOT sent to the client before submission.
  const questions = await db
    .select({ id: quizQuestions.id, type: quizQuestions.type, prompt: quizQuestions.prompt, options: quizQuestions.options })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, id))
    .orderBy(asc(quizQuestions.ordinal));
  const previous = await db.select({ score: quizAttempts.score, total: quizAttempts.total, createdAt: quizAttempts.createdAt }).from(quizAttempts).where(and(eq(quizAttempts.quizId, id), eq(quizAttempts.userId, user.id))).orderBy(desc(quizAttempts.createdAt)).limit(5);
  const isMock = quiz.kind === "mock" && quiz.startedAt && quiz.timeLimitSec;
  const mock = isMock ? { deadline: new Date(quiz.startedAt!.getTime() + quiz.timeLimitSec! * 1000).toISOString(), limitSec: quiz.timeLimitSec! } : undefined;
  const initial = isMock ? await getMockResult(user.id, quiz.id) : null;
  return <QuizRunner quiz={quiz} questions={questions} previous={previous.map((p) => ({ score: p.score, total: p.total }))} mock={mock} initial={initial} />;
}
