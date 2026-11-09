import { and, asc, eq, lte } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { flashcards, subjects, topics } from "@/db/schema";
import { ReviewSession } from "@/components/review-session";
import { Empty, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Repaso" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const user = await requireUser();
  const { subject } = await searchParams;
  const conds = [eq(flashcards.userId, user.id), lte(flashcards.due, new Date())];
  if (subject && /^[0-9a-f-]{36}$/.test(subject)) conds.push(eq(flashcards.subjectId, subject));
  const cards = await db
    .select({ id: flashcards.id, front: flashcards.front, back: flashcards.back, state: flashcards.state, subject: subjects.name, topic: topics.title, origin: flashcards.origin })
    .from(flashcards)
    .innerJoin(subjects, eq(subjects.id, flashcards.subjectId))
    .leftJoin(topics, eq(topics.id, flashcards.topicId))
    .where(and(...conds))
    .orderBy(asc(flashcards.due))
    .limit(50);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Repaso</h1>
        <p className="text-ink-2">Repetición espaciada (FSRS): cada tarjeta vuelve justo cuando estás a punto de olvidarla.</p>
      </header>
      {cards.length === 0 ? (
        <Empty title="No tienes tarjetas pendientes ahora mismo">
          <p className="mb-3">Genera tarjetas desde tus apuntes en cualquier asignatura.</p>
          <Link href="/subjects" className={buttonClass("secondary", "sm")}>Ir a asignaturas</Link>
        </Empty>
      ) : (
        <ReviewSession cards={cards} />
      )}
    </div>
  );
}
