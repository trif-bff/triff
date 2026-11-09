import Link from "next/link";
import { CalendarDays, Clock, Flame, Layers, Lightbulb, Target } from "lucide-react";
import { LearnToday } from "@/components/learn-today";
import { PlanCheck } from "@/components/plan-check";
import { Bar, Card, Empty, MasteryBadge, ProgressRing, SectionTitle, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { dueCards, streak, studyMinutesThisWeek, todaysPlan } from "@/lib/services/progress";
import { recommend, subjectSummaries } from "@/lib/services/recommend";

export const metadata = { title: "Hoy" };

const ACTIVITY: Record<string, string> = { learn: "Aprender", practice: "Practicar", review: "Repasar", mock: "Simulacro" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("es-ES", { hour: "numeric", hour12: false, timeZone: "Europe/Madrid" }).format(new Date()));
  return h < 6 ? "Buenas noches" : h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
}

export default async function Dashboard() {
  const user = await requireUser();
  const [summaries, plan, days, minutes, due] = await Promise.all([
    subjectSummaries(user.id),
    todaysPlan(user.id),
    streak(user.id),
    studyMinutesThisWeek(user.id),
    dueCards(user.id),
  ]);
  const recs = recommend(summaries);
  const withTopics = summaries.filter((s) => s.topics.length);
  const global = withTopics.length ? withTopics.reduce((a, s) => a + s.mastery, 0) / withTopics.length : 0;
  const planDone = plan.filter((p) => p.done).length;
  const upcoming = summaries.filter((s) => s.daysLeft !== null && s.daysLeft >= 0).sort((a, b) => a.daysLeft! - b.daysLeft!);

  return (
    <div className="space-y-8">
      <header className="rise">
        <p className="text-sm text-ink-3">{new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{greeting()}, {user.name.split(" ")[0]}</h1>
        {plan.length > 0 && <p className="mt-1 text-ink-2">Hoy tienes {plan.length} actividad{plan.length > 1 ? "es" : ""} en tu plan ({planDone} hecha{planDone === 1 ? "" : "s"}).</p>}
      </header>

      <LearnToday subjects={summaries.map((s) => ({ id: s.id, name: s.name }))} />

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Target} label="Dominio global" value={`${Math.round(global * 100)} %`} />
        <Stat icon={Flame} label="Racha" value={`${days} día${days === 1 ? "" : "s"}`} />
        <Stat icon={Clock} label="Estudio (7 días)" value={`${minutes} min`} />
        <Stat icon={Layers} label="Tarjetas pendientes" value={String(due)} href={due ? "/review" : undefined} />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionTitle>Plan de hoy</SectionTitle>
          {plan.length === 0 ? (
            <Empty title="No hay actividades planificadas para hoy">
              Crea una asignatura con fecha de examen y sube tus apuntes para generar el plan.
            </Empty>
          ) : (
            <ul className="space-y-2">
              {plan.map((p) => (
                <li key={p.id} className="card flex items-start gap-3 p-4">
                  <PlanCheck id={p.id} done={p.done} />
                  <div className="min-w-0 flex-1">
                    <p className={p.done ? "text-ink-3 line-through" : "font-medium"}>
                      {ACTIVITY[p.activity]} {p.topicTitle ? `· ${p.topicTitle}` : ""}
                    </p>
                    <p className="text-xs text-ink-3">{p.subjectName} · {p.minutes} min · {p.reason}</p>
                  </div>
                  {!p.done && (
                    <Link
                      href={p.activity === "review" ? `/review?subject=${p.subjectId}` : p.activity === "mock" ? `/subjects/${p.subjectId}#tools` : `/tutor?subject=${p.subjectId}&mode=${p.activity === "learn" ? "explain" : "practice"}&q=${encodeURIComponent(p.topicTitle ?? "")}`}
                      className={buttonClass("secondary", "sm")}
                    >
                      Empezar
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>Recomendaciones</SectionTitle>
          {recs.length === 0 ? (
            <Empty title="Todo al día">Cuando haya algo que mejorar, te diré qué y por qué.</Empty>
          ) : (
            <ul className="space-y-2">
              {recs.map((r) => (
                <li key={r.title}>
                  <Link href={r.href} className="card group flex gap-3 p-4 transition-colors hover:border-primary/40">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                    <div>
                      <p className="font-medium group-hover:text-primary">{r.title}</p>
                      <p className="mt-0.5 text-xs text-ink-3"><span className="font-medium">Por qué: </span>{r.why}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <SectionTitle action={<Link href="/subjects?new=1" className={buttonClass("ghost", "sm")}>+ Nueva asignatura</Link>}>Asignaturas activas</SectionTitle>
        {summaries.length === 0 ? (
          <Empty title="Aún no tienes asignaturas">
            <Link href="/subjects?new=1" className={buttonClass("primary", "sm")}>Crear la primera</Link>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {summaries.map((s) => {
              const mastered = s.topics.filter((t) => t.estimate.level === "mastered").length;
              const target = s.targetGrade ? s.targetGrade / 10 : 0.8;
              return (
                <Link key={s.id} href={`/subjects/${s.id}`} className="card flex items-center gap-4 p-5 transition-colors hover:border-primary/40">
                  <ProgressRing value={s.mastery} size={72} label={`Dominio de ${s.name}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="text-xs text-ink-3">
                      {s.topics.length} temas · {mastered} dominados{s.daysLeft !== null && s.daysLeft >= 0 ? ` · examen en ${s.daysLeft} días` : ""}
                    </p>
                    <div className="mt-2.5">
                      <Bar value={Math.min(1, s.mastery / target)} />
                      <p className="mt-1 text-xs text-ink-3">
                        {s.mastery >= target ? "Objetivo alcanzado" : `Te falta ${Math.round((target - s.mastery) * 100)} puntos de dominio para tu objetivo${s.targetGrade ? ` (${s.targetGrade})` : ""}`}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <SectionTitle>Próximos exámenes</SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2">
            {upcoming.map((s) => {
              const weakest = [...s.topics].filter((t) => t.estimate.level !== "mastered").sort((a, b) => a.estimate.p - b.estimate.p)[0];
              return (
                <li key={s.id} className="card flex items-center gap-4 p-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <CalendarDays className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-ink-3">
                      {new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(new Date(s.examDate!))} · {s.daysLeft === 0 ? "¡hoy!" : `en ${s.daysLeft} días`}
                    </p>
                    {weakest && <p className="mt-1 flex items-center gap-2 text-xs text-ink-2">Punto débil: {weakest.title} <MasteryBadge level={weakest.estimate.level} /></p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, href }: { icon: typeof Target; label: string; value: string; href?: string }) {
  const body = (
    <Card className="p-4">
      <Icon className="mb-2 h-4 w-4 text-accent" aria-hidden />
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-ink-3">{label}</p>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
