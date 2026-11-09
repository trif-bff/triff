import "server-only";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, subjects } from "@/db/schema";
import { daysBetween } from "@/lib/learning/planner";
import { dueCards, overallMastery, todayIso, topicMastery, type TopicMastery } from "./progress";

export type Recommendation = {
  title: string;
  why: string;
  href: string;
  priority: number;
  kind: "review" | "gap" | "assess" | "upload" | "learn" | "urgent";
};

export type SubjectSummary = {
  id: string;
  name: string;
  level: string | null;
  examDate: string | null;
  daysLeft: number | null;
  targetGrade: number | null;
  mastery: number;
  topics: TopicMastery[];
  documents: number;
  due: number;
};

export async function subjectSummaries(userId: string): Promise<SubjectSummary[]> {
  const ss = await db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(subjects.examDate);
  const today = todayIso();
  return Promise.all(
    ss.map(async (s) => {
      const [tm, [{ n }], due] = await Promise.all([
        topicMastery(userId, s.id),
        db.select({ n: count() }).from(documents).where(eq(documents.subjectId, s.id)),
        dueCards(userId, s.id),
      ]);
      return {
        id: s.id,
        name: s.name,
        level: s.level,
        examDate: s.examDate,
        daysLeft: s.examDate ? daysBetween(today, s.examDate) : null,
        targetGrade: s.targetGrade,
        mastery: overallMastery(tm),
        topics: tm,
        documents: n,
        due,
      };
    }),
  );
}

/** Explainable recommendations: every item says why it is suggested. */
export function recommend(summaries: SubjectSummary[]): Recommendation[] {
  const recs: Recommendation[] = [];
  for (const s of summaries) {
    const urgent = s.daysLeft !== null && s.daysLeft >= 0 && s.daysLeft <= 7;
    if (s.documents === 0) {
      recs.push({ kind: "upload", title: `Sube tus apuntes de ${s.name}`, why: "Sin material no puedo crear un plan ni preguntas fiables sobre tu temario.", href: `/subjects/${s.id}`, priority: 90 });
      continue;
    }
    if (s.due > 0) {
      recs.push({ kind: "review", title: `Repasa ${s.due} tarjeta${s.due > 1 ? "s" : ""} de ${s.name}`, why: "Según el modelo de memoria FSRS, tu probabilidad de recordarlas está bajando del 90 %.", href: `/review?subject=${s.id}`, priority: 80 + (urgent ? 10 : 0) });
    }
    for (const t of s.topics) {
      if (t.estimate.isGap) {
        recs.push({ kind: "gap", title: `Refuerza «${t.title}»`, why: `Laguna consolidada: dominio estimado del ${Math.round(t.estimate.p * 100)} % con varias evidencias, no un fallo aislado.`, href: `/tutor?subject=${s.id}&mode=explain&q=${encodeURIComponent(`Explícame ${t.title} de otra forma`)}`, priority: 75 + t.importance * 5 + (urgent ? 10 : 0) });
      } else if (t.next.action === "assess") {
        recs.push({ kind: "assess", title: `Comprueba «${t.title}» con un cuestionario`, why: t.next.reason, href: `/subjects/${s.id}#topic-${t.id}`, priority: 55 + t.importance * 5 });
      } else if (t.next.action === "explain_differently") {
        recs.push({ kind: "gap", title: `Otra explicación de «${t.title}»`, why: t.next.reason, href: `/tutor?subject=${s.id}&mode=explain&q=${encodeURIComponent(`Explícame ${t.title} con una analogía`)}`, priority: 70 });
      }
    }
    const notStarted = s.topics.filter((t) => t.estimate.level === "not_started").sort((a, b) => b.importance - a.importance);
    if (notStarted[0]) {
      recs.push({ kind: urgent ? "urgent" : "learn", title: `Empieza «${notStarted[0].title}»`, why: urgent ? `Quedan ${s.daysLeft} días para el examen y aún no has trabajado este tema.` : "Es el tema más importante que aún no has empezado.", href: `/tutor?subject=${s.id}&mode=explain&q=${encodeURIComponent(`Explícame ${notStarted[0].title}`)}`, priority: (urgent ? 85 : 50) + notStarted[0].importance * 5 });
    }
  }
  return recs.sort((a, b) => b.priority - a.priority).slice(0, 5);
}
