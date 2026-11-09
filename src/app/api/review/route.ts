import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { flashcards, reviewLogs, subjects } from "@/db/schema";
import { guard, isResponse, jsonError } from "@/lib/http";
import { gradeToScore, isGrade, review } from "@/lib/learning/srs";
import { grantXp, recordLearning } from "@/lib/services/gamification";
import { XP } from "@/lib/learning/gamification";

const body = z.object({
  cardId: z.uuid(),
  rating: z.number().int().min(1).max(4),
  durationMs: z.number().int().min(0).max(30 * 60_000).default(0),
});

export async function POST(req: Request) {
  const user = await guard(req, { limit: 120 });
  if (isResponse(user)) return user;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isGrade(parsed.data.rating)) return jsonError("Parámetros no válidos");
  const { cardId, rating, durationMs } = parsed.data;

  const [row] = await db
    .select({ card: flashcards, examDate: subjects.examDate })
    .from(flashcards)
    .innerJoin(subjects, eq(subjects.id, flashcards.subjectId))
    .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, user.id)));
  if (!row) return jsonError("Tarjeta no encontrada", 404);

  const now = new Date();
  const wasDue = row.card.due <= now; // XP only for reviews that were due: no farming by re-reviewing
  const exam = row.examDate ? new Date(`${row.examDate}T08:00:00`) : null;
  const next = review(row.card, rating as 1 | 2 | 3 | 4, now, exam);
  await db.update(flashcards).set(next).where(eq(flashcards.id, cardId));
  await db.insert(reviewLogs).values({ flashcardId: cardId, userId: user.id, rating, durationMs });
  const reviewXp = wasDue ? await grantXp(user.id, { kind: "review", amount: XP.review }) : 0;
  const rewards = await recordLearning(user.id, row.card.subjectId, [
    { userId: user.id, subjectId: row.card.subjectId, topicId: row.card.topicId, kind: "flashcard", score: gradeToScore(rating as 1 | 2 | 3 | 4), durationMs },
  ]);
  return NextResponse.json({ due: next.due, state: next.state, rewards: { ...rewards, xp: rewards.xp + reviewXp } });
}
