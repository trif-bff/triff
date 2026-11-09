import Link from "next/link";
import { Award, CheckCircle2, Flame, Lock, Moon, Sparkles, Target } from "lucide-react";
import { Bar, Card, SectionTitle, cn } from "@/components/ui";
import { BADGES, type BadgeId } from "@/lib/learning/gamification";
import type { gamificationSummary } from "@/lib/services/gamification";

type Summary = Awaited<ReturnType<typeof gamificationSummary>>;

export function LevelChip({ s }: { s: Summary }) {
  return (
    <Link href="/logros" className="card flex items-center gap-3 px-4 py-2.5 hover:border-primary/40" aria-label={`Nivel ${s.level.level}, ${s.xp} puntos de experiencia`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft font-semibold text-accent tabular-nums">{s.level.level}</span>
      <span className="min-w-28">
        <span className="block text-xs text-ink-3">{s.level.title} · {s.xp} XP</span>
        <Bar value={s.level.progress} className="mt-1" />
      </span>
    </Link>
  );
}

export function Challenges({ s, compact = false }: { s: Summary; compact?: boolean }) {
  const done = s.challenges.filter((c) => c.done).length;
  return (
    <section aria-labelledby="challenges-title">
      <SectionTitle action={<span className="text-xs text-ink-3 tabular-nums">{done}/{s.challenges.length} completados</span>}>
        <span id="challenges-title">Retos de hoy</span>
      </SectionTitle>
      <ul className={cn("grid gap-2", !compact && "sm:grid-cols-3")}>
        {s.challenges.map((c) => {
          const pct = c.progress / c.target;
          return (
            <li key={c.id} className={cn("card p-4", c.done && "border-success/40")}>
              <div className="flex items-start gap-2">
                {c.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Completado" /> : <Target className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />}
                <p className={cn("text-sm font-medium", c.done && "text-ink-2")}>{c.title}</p>
              </div>
              <Bar value={c.done ? 1 : pct} className="mt-3" />
              <p className="mt-1 text-xs text-ink-3 tabular-nums">
                {c.done ? "¡Hecho! +15 XP" : c.kind === "weak_topic_quiz" ? (c.progress ? `${c.progress} % de aciertos` : "Aún sin intentar") : `${c.progress}/${c.target}`}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function StreakCard({ s }: { s: Summary }) {
  return (
    <Card className="flex items-center gap-4">
      <Flame className="h-8 w-8 text-accent" aria-hidden />
      <div>
        <p className="text-2xl font-semibold tabular-nums">{s.streak.streak} día{s.streak.streak === 1 ? "" : "s"}</p>
        <p className="flex items-center gap-1 text-xs text-ink-3">
          <Moon className="h-3 w-3" aria-hidden />
          {s.streak.restAvailable ? "Tienes 1 día de descanso disponible esta semana" : "Ya usaste tu día de descanso esta semana"}
        </p>
      </div>
    </Card>
  );
}

export function ActivityCalendar({ activity, today }: { activity: Map<string, number>; today: string }) {
  const weeks = 12;
  const end = new Date(`${today}T12:00:00Z`);
  const dow = (end.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - dow - (weeks - 1) * 7);
  const cells: { day: string; n: number; future: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const day = d.toISOString().slice(0, 10);
    cells.push({ day, n: activity.get(day) ?? 0, future: day > today });
  }
  const level = (n: number) => (n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : n < 30 ? 3 : 4);
  const shade = ["bg-surface-2", "bg-accent/25", "bg-accent/50", "bg-accent/75", "bg-accent"];
  const studied = cells.filter((c) => c.n > 0).length;
  return (
    <figure>
      <div className="inline-grid max-w-full grid-flow-col grid-rows-7 gap-1 overflow-x-auto" role="img" aria-label={`Has estudiado ${studied} de los últimos ${weeks * 7} días`}>
        {cells.map((c) => (
          <span key={c.day} title={`${c.day}: ${c.n} actividades`} className={cn("h-3.5 w-3.5 rounded-[3px]", c.future ? "opacity-0" : shade[level(c.n)])} />
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-ink-3">{studied} {studied === 1 ? "día" : "días"} con estudio en las últimas {weeks} semanas. Cuenta la actividad, no el tiempo conectado.</figcaption>
    </figure>
  );
}

export function BadgeGrid({ earned }: { earned: Map<BadgeId, Date> }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {(Object.keys(BADGES) as BadgeId[]).map((id) => {
        const at = earned.get(id);
        return (
          <li key={id} className={cn("card p-4 text-center", !at && "opacity-60")}>
            <span className={cn("mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full", at ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-3")}>
              {at ? <Award className="h-5 w-5" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
            </span>
            <p className="text-sm font-semibold">{BADGES[id].name}</p>
            <p className="mt-1 text-xs text-ink-3">{BADGES[id].description}</p>
            <p className="mt-1.5 text-xs font-medium">{at ? <span className="text-success">Conseguida</span> : <span className="sr-only">Bloqueada</span>}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function RewardNote({ rewards }: { rewards?: { xp: number; badges: { name: string }[]; challengesCompleted: string[] } | null }) {
  if (!rewards || (rewards.xp <= 0 && rewards.badges.length === 0)) return null;
  return (
    <p role="status" className="rise inline-flex flex-wrap items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm text-ink">
      <Sparkles className="h-4 w-4 text-accent" aria-hidden />
      {rewards.xp > 0 && <span className="font-semibold">+{rewards.xp} XP</span>}
      {rewards.badges.map((b) => <span key={b.name}>· Insignia: <strong>{b.name}</strong></span>)}
      {rewards.challengesCompleted.map((c) => <span key={c}>· Reto completado: {c}</span>)}
    </p>
  );
}
