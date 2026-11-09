import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { AlertTriangle, CheckCircle2, FileText, Loader2, MessageCircleQuestion, XCircle } from "lucide-react";
import { db } from "@/db";
import { documents, planItems, quizAttempts, quizzes, topics } from "@/db/schema";
import { rebuildPlan, updateSubject } from "../../actions";
import { GenerateTools } from "@/components/generate-tools";
import { MockStarter } from "@/components/mock-starter";
import { mockHistory } from "@/lib/services/exams";
import { SubjectForm } from "@/components/subject-form";
import { Uploader } from "@/components/uploader";
import { Bar, Card, Empty, MasteryBadge, ProgressRing, SectionTitle, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getOwnedSubject } from "@/lib/services/documents";
import { dueCards, overallMastery, todayIso, topicMastery } from "@/lib/services/progress";

const ACTIVITY: Record<string, string> = { learn: "Aprender", practice: "Practicar", review: "Repasar", mock: "Simulacro" };
const NEXT_LABEL: Record<string, string> = { learn: "Aprender", practice: "Practicar", explain_differently: "Otra explicación", assess: "Evaluar", advance: "Avanzar" };

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const subject = await getOwnedSubject(user.id, id);
  if (!subject) notFound();

  const [docs, tm, plan, qz, attempts, due, mocks] = await Promise.all([
    db.select().from(documents).where(eq(documents.subjectId, id)).orderBy(desc(documents.createdAt)),
    topicMastery(user.id, id),
    db
      .select({ id: planItems.id, day: planItems.day, activity: planItems.activity, minutes: planItems.minutes, reason: planItems.reason, done: planItems.done, topic: topics.title })
      .from(planItems)
      .leftJoin(topics, eq(topics.id, planItems.topicId))
      .where(and(eq(planItems.subjectId, id), gte(planItems.day, todayIso())))
      .orderBy(asc(planItems.day))
      .limit(30),
    db.select().from(quizzes).where(and(eq(quizzes.subjectId, id), eq(quizzes.kind, "practice"))).orderBy(desc(quizzes.createdAt)).limit(10),
    db.select().from(quizAttempts).innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId)).where(and(eq(quizzes.subjectId, id), eq(quizAttempts.userId, user.id))).orderBy(desc(quizAttempts.createdAt)).limit(20),
    dueCards(user.id, id),
    mockHistory(user.id, id),
  ]);
  const mastery = overallMastery(tm);
  const byDay = Map.groupBy(plan, (p) => p.day);
  const lastAttempt = new Map<string, { score: number; total: number }>();
  for (const a of attempts) if (!lastAttempt.has(a.quiz_attempts.quizId)) lastAttempt.set(a.quiz_attempts.quizId, a.quiz_attempts);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center gap-6">
        <ProgressRing value={mastery} label="Dominio de la asignatura" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-3">{subject.level ?? "Asignatura"}{subject.examDate ? ` · examen el ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(new Date(subject.examDate))}` : ""}</p>
          <h1 className="font-display text-3xl font-semibold">{subject.name}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {tm.filter((t) => t.estimate.level === "mastered").length} de {tm.length} temas dominados
            {subject.targetGrade ? ` · objetivo: ${subject.targetGrade}` : ""} · {subject.sourcesOnly ? "solo con tus apuntes" : "apuntes + conocimiento general"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/tutor?subject=${id}`} className={buttonClass("primary")}><MessageCircleQuestion className="h-4 w-4" /> Tutora</Link>
          <Link href={`/review?subject=${id}`} className={buttonClass("secondary")}>Repasar ({due})</Link>
        </div>
      </header>

      <section id="documents">
        <SectionTitle>Apuntes y materiales</SectionTitle>
        <Uploader subjectId={id} />
        {docs.length > 0 && (
          <ul className="mt-4 divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{d.filename}</span>
                {d.injectionFlags > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-accent" title="Contiene texto con forma de instrucciones; se trata solo como dato.">
                    <AlertTriangle className="h-3.5 w-3.5" /> {d.injectionFlags} aviso{d.injectionFlags > 1 ? "s" : ""}
                  </span>
                )}
                <span className="text-xs text-ink-3">{d.pageCount && d.pageCount > 1 ? `${d.pageCount} págs.` : ""}</span>
                {d.status === "ready" && <CheckCircle2 className="h-4 w-4 text-success" aria-label="Procesado" />}
                {d.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="Procesando" />}
                {d.status === "failed" && <span className="inline-flex items-center gap-1 text-xs text-danger"><XCircle className="h-4 w-4" /> {d.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Mapa de conocimiento</SectionTitle>
        {tm.length === 0 ? (
          <Empty title="Aún no hay temas">Se detectan automáticamente a partir de los títulos de tus apuntes.</Empty>
        ) : (
          <ul className="grid gap-2">
            {tm.map((t) => (
              <li key={t.id} id={`topic-${t.id}`} className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.title}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <Bar value={t.estimate.level === "not_started" ? 0 : t.estimate.p} className="max-w-48" />
                    <MasteryBadge level={t.estimate.level} />
                    {t.estimate.isGap && <span className="text-xs font-medium text-danger">Laguna</span>}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-3">Siguiente paso: <span className="font-medium text-ink-2">{NEXT_LABEL[t.next.action]}</span> — {t.next.reason}</p>
                </div>
                <Link href={`/tutor?subject=${id}&mode=${t.next.action === "learn" || t.next.action === "explain_differently" ? "explain" : "practice"}&q=${encodeURIComponent(t.title)}`} className={buttonClass("secondary", "sm")}>
                  {NEXT_LABEL[t.next.action]}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section id="tools">
          <SectionTitle>Practicar con tus apuntes</SectionTitle>
          <Card>
            <GenerateTools subjectId={id} topics={tm.map((t) => ({ id: t.id, title: t.title }))} />
            {qz.length > 0 && (
              <ul className="mt-5 space-y-1.5 border-t border-border pt-4">
                {qz.map((q) => {
                  const a = lastAttempt.get(q.id);
                  return (
                    <li key={q.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/quiz/${q.id}`} className="truncate font-medium text-primary hover:underline">{q.title}</Link>
                      <span className="shrink-0 text-xs text-ink-3">{a ? `${a.score}/${a.total}` : "sin hacer"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle action={<form action={rebuildPlan.bind(null, id)}><button className={buttonClass("ghost", "sm")}>Recalcular</button></form>}>Plan de estudio</SectionTitle>
          {plan.length === 0 ? (
            <Empty title="Sin plan todavía">Añade la fecha del examen y sube apuntes; el plan se genera y se ajusta con tus resultados.</Empty>
          ) : (
            <ol className="space-y-3">
              {[...byDay.entries()].slice(0, 7).map(([day, items]) => (
                <li key={day}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3">
                    {day === todayIso() ? "Hoy" : new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00`))}
                  </p>
                  <ul className="space-y-1">
                    {items.map((p) => (
                      <li key={p.id} className={`text-sm ${p.done ? "text-ink-3 line-through" : ""}`}>
                        <span className="font-medium">{ACTIVITY[p.activity]}</span>{p.topic ? ` · ${p.topic}` : ""} <span className="text-ink-3">({p.minutes} min) — {p.reason}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section id="mock">
        <SectionTitle>Simulacro de examen</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <MockStarter subjectId={id} />
          </Card>
          <Card>
            <p className="mb-3 font-medium">Tus simulacros</p>
            {mocks.length === 0 ? (
              <p className="text-sm text-ink-3">Aún no has hecho ninguno. Hazlo cuando hayas trabajado los temas: mide cómo llegas al examen.</p>
            ) : (
              <ul className="space-y-2">
                {mocks.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link href={`/quiz/${m.id}`} className="truncate font-medium text-primary hover:underline">{m.title}</Link>
                    <span className="shrink-0 tabular-nums text-ink-3">
                      {m.grade === null ? "en curso" : <span className={m.grade >= 5 ? "font-semibold text-success" : "font-semibold text-danger"}>{m.grade.toFixed(1)}</span>}
                      {m.late ? " · fuera de tiempo" : ""} · {new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(m.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">Ajustes del examen</summary>
        <div className="mt-4">
          <SubjectForm action={updateSubject.bind(null, id)} initial={subject} submitLabel="Guardar y recalcular plan" />
        </div>
      </details>
    </div>
  );
}
