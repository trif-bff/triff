import { ActivityCalendar, BadgeGrid, Challenges, StreakCard } from "@/components/gamification";
import { Bar, Card, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { DAILY_ACTIVITY_CAP, XP } from "@/lib/learning/gamification";
import { gamificationSummary } from "@/lib/services/gamification";
import { todayIso } from "@/lib/services/progress";
import { toggleGamification } from "../actions";

export const metadata = { title: "Logros" };

const RULES: [string, string][] = [
  ["Repasar una tarjeta que tocaba repasar", `+${XP.review} XP`],
  ["Responder una pregunta (y acertarla)", `+${XP.answer} XP (+${XP.correct})`],
  ["Subir apuntes", `+${XP.documentUploaded} XP`],
  ["Completar un simulacro", `+${XP.mockCompleted} XP`],
  ["Mejorar la nota del simulacro anterior", `+${XP.mockImprovementPerPoint} XP por punto`],
  ["Subir de nivel de dominio en un tema", `+${XP.levelUp} XP (una vez por nivel)`],
  ["Dominar un tema", `+${XP.mastered} XP`],
  ["Superar una laguna", `+${XP.gapRecovered} XP`],
  ["Cada reto diario / los tres", `+${XP.challenge} / +${XP.allChallenges} XP`],
  ["Cada insignia", `+${XP.badge} XP`],
];

export default async function LogrosPage() {
  const user = await requireUser();
  const s = await gamificationSummary(user.id);

  if (!s.enabled) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold">Logros</h1>
        <Card>
          <p className="font-medium">Has ocultado los puntos, niveles y retos.</p>
          <p className="mt-1 text-sm text-ink-3">Tu progreso real (dominio, plan y repasos) sigue funcionando igual.</p>
          <form action={toggleGamification.bind(null, true)} className="mt-4">
            <button className="text-sm font-medium text-primary hover:underline">Volver a mostrarlos</button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Logros</h1>
          <p className="text-ink-2">Premiamos la constancia y la mejora real, no el tiempo conectado.</p>
        </div>
        <form action={toggleGamification.bind(null, false)}>
          <button className="text-sm text-ink-3 hover:text-ink hover:underline">Ocultar puntos y retos</button>
        </form>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex items-center gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-accent-soft font-display text-3xl font-semibold text-accent tabular-nums">{s.level.level}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Nivel {s.level.level} · {s.level.title}</p>
            <p className="text-sm text-ink-3 tabular-nums">{s.xp} XP · hoy +{s.xpToday}</p>
            <Bar value={s.level.progress} className="mt-2" />
            <p className="mt-1 text-xs text-ink-3 tabular-nums">Faltan {s.level.toNext} XP para el nivel {s.level.level + 1}</p>
          </div>
        </Card>
        <StreakCard s={s} />
      </div>

      <Challenges s={s} />

      <section>
        <SectionTitle>Tu constancia</SectionTitle>
        <Card><ActivityCalendar activity={s.activity} today={todayIso()} /></Card>
      </section>

      <section>
        <SectionTitle>Insignias</SectionTitle>
        <BadgeGrid earned={s.badges} />
      </section>

      <section>
        <SectionTitle>Cómo se ganan los puntos</SectionTitle>
        <Card>
          <ul className="divide-y divide-border text-sm">
            {RULES.map(([what, xp]) => (
              <li key={what} className="flex justify-between gap-4 py-2"><span>{what}</span><span className="shrink-0 font-medium tabular-nums">{xp}</span></li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            Los puntos por actividad tienen un tope de {DAILY_ACTIVITY_CAP} XP al día: hacer cuestionarios sin parar no da más puntos que estudiar con calma.
            Los logros de mejora solo se consiguen una vez. La racha perdona un día de descanso por semana.
          </p>
        </Card>
      </section>
    </div>
  );
}
