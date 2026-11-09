/**
 * Study plan generator. Deterministic and explainable: every item carries the
 * reason it was scheduled. Re-run whenever mastery, availability or the exam
 * date changes (the caller replaces future, not-done items).
 */

export type PlanTopic = { id: string; title: string; importance: number; mastery: number; isGap: boolean };

export type PlanInput = {
  today: string; // YYYY-MM-DD
  examDate: string | null;
  minutesPerDay: number;
  topics: PlanTopic[];
  horizonDays?: number; // used when there is no exam date
};

export type PlanItem = {
  day: string;
  topicId: string | null;
  activity: "learn" | "practice" | "review" | "mock";
  minutes: number;
  reason: string;
};

const DAY = 86_400_000;

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(d.getTime() + n * DAY).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY);
}

/** Priority: important topics the student doesn't know yet go first; gaps get a boost. */
export function priority(t: PlanTopic) {
  return t.importance * (1 - t.mastery) * (t.isGap ? 1.5 : 1) + 0.05;
}

export function buildPlan(input: PlanInput): PlanItem[] {
  const { today, minutesPerDay } = input;
  const topics = input.topics.filter((t) => t.mastery < 0.95);
  if (topics.length === 0 || minutesPerDay <= 0) return [];

  const totalDays = input.examDate
    ? Math.max(0, daysBetween(today, input.examDate))
    : (input.horizonDays ?? 14);
  if (totalDays === 0) return [];

  const block = Math.max(10, Math.min(30, Math.round(minutesPerDay / 2)));
  const items: PlanItem[] = [];
  const hasExam = Boolean(input.examDate);
  // Reserve the last day before the exam for a mock exam when there's room.
  const mockDay = hasExam && totalDays >= 3 ? totalDays - 1 : -1;

  // Queue of pending "learn" sessions ordered by priority.
  const ranked = [...topics].sort((a, b) => priority(b) - priority(a));
  const learned = new Map<string, number>(); // topicId -> day index learned
  let cursor = 0;

  for (let d = 0; d < totalDays; d++) {
    const day = addDays(today, d);
    let budget = minutesPerDay;

    if (d === mockDay) {
      items.push({ day, topicId: null, activity: "mock", minutes: Math.min(budget, 60), reason: "Simulacro final la víspera del examen." });
      continue;
    }

    // Spaced reviews (1, 3, 7 days after learning) take precedence over new material.
    for (const [topicId, learnedDay] of learned) {
      if (budget < block) break;
      const gap = d - learnedDay;
      if (gap === 1 || gap === 3 || gap === 7) {
        const t = topics.find((x) => x.id === topicId)!;
        items.push({ day, topicId, activity: "review", minutes: block, reason: `Repaso espaciado (+${gap} d) de «${t.title}».` });
        budget -= block;
      }
    }

    while (budget >= block && cursor < ranked.length) {
      const t = ranked[cursor++];
      const activity = t.mastery < 0.4 ? "learn" : "practice";
      const reason =
        activity === "learn"
          ? `${t.isGap ? "Laguna detectada" : "Tema sin dominar"} con importancia ${t.importance.toFixed(1)}.`
          : `Dominio del ${Math.round(t.mastery * 100)} %: práctica para consolidar.`;
      items.push({ day, topicId: t.id, activity, minutes: block, reason });
      learned.set(t.id, d);
      budget -= block;
    }

    // When all topics have been introduced, recycle the weakest ones as practice.
    const scheduledToday = new Set(items.filter((i) => i.day === day).map((i) => i.topicId));
    const candidates = [...topics].sort((a, b) => a.mastery - b.mastery).filter((t) => !scheduledToday.has(t.id));
    if (cursor >= ranked.length && budget >= block && candidates.length > 0) {
      const weakest = candidates[d % candidates.length];
      items.push({ day, topicId: weakest.id, activity: "practice", minutes: block, reason: `Refuerzo del tema con menor dominio («${weakest.title}»).` });
    }
  }
  return items;
}
