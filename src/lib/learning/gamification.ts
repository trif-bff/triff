/**
 * Gamification rules (pure, unit-tested).
 *
 * Principles (see .claude/rules/pedagogy.md):
 *  - Reward consistency, effort and REAL improvement — never time online.
 *  - Activity XP has a daily cap, so grinding generated quizzes is pointless.
 *  - Improvement XP (mastery level-ups, recovered gaps, better mock grades) is
 *    granted once per achievement (idempotent keys), so it cannot be farmed by
 *    letting knowledge decay and re-learning.
 *  - Streaks forgive one rest day per week: rest is part of learning.
 */

export const XP = {
  review: 2, // a flashcard reviewed when it was due
  answer: 1, // any answered question
  correct: 1, // bonus when correct
  mockCompleted: 30,
  mockImprovementPerPoint: 10, // per point above the previous mock
  levelUp: 25, // a topic reaches a higher mastery level (first time)
  mastered: 50, // a topic reaches "Dominado" (first time)
  gapRecovered: 40,
  challenge: 15,
  allChallenges: 20,
  badge: 50,
  documentUploaded: 5,
} as const;

/** Activity XP (reviews, answers, uploads) per day. Achievements are not capped. */
export const DAILY_ACTIVITY_CAP = 150;

export const ACTIVITY_KINDS = new Set(["review", "answer", "document"]);

export function capActivityXp(amount: number, alreadyToday: number) {
  return Math.max(0, Math.min(amount, DAILY_ACTIVITY_CAP - alreadyToday));
}

/* ---------------------------------- Levels --------------------------------- */

/** XP needed to *reach* level n (level 1 = 0 XP). Gentle quadratic curve. */
export function xpForLevel(n: number) {
  return n <= 1 ? 0 : 50 * (n - 1) * n;
}

export function levelFromXp(xp: number) {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  const floor = xpForLevel(n);
  const next = xpForLevel(n + 1);
  return { level: n, intoLevel: xp - floor, toNext: next - xp, progress: (xp - floor) / (next - floor), title: levelTitle(n) };
}

export function levelTitle(n: number) {
  return n < 5 ? "Aprendiz" : n < 10 ? "Constante" : n < 20 ? "Experta/o" : "Maestra/o";
}

/* ---------------------------------- Streak --------------------------------- */

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive-day streak that tolerates `restPerWeek` missed days in any
 * rolling 7-day window. Today not yet studied does not break the streak.
 */
export function computeStreak(activeDays: Set<string>, today: string, restPerWeek = 1) {
  let day = activeDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  const rests: string[] = [];
  for (let guard = 0; guard < 800; guard++) {
    if (activeDays.has(day)) {
      streak++;
    } else {
      // Rests already granted (all later than `day`) that fall in the same 7-day window.
      const recentRests = rests.filter((r) => r <= addDays(day, 6)).length;
      // A rest day only bridges two active days.
      if (recentRests >= restPerWeek || !activeDays.has(addDays(day, -1))) break;
      rests.push(day);
    }
    day = addDays(day, -1);
  }
  const restUsedThisWeek = rests.filter((r) => r > addDays(today, -7)).length;
  return { streak, restDaysUsed: rests.length, restAvailable: restUsedThisWeek < restPerWeek };
}

/* ------------------------------- Daily challenges -------------------------- */

export type ChallengeKind = "reviews" | "weak_topic_quiz" | "plan_topics" | "upload" | "any_practice";

export type ChallengeSpec = { slot: number; kind: ChallengeKind; target: number; topicId: string | null; title: string };

export type ChallengeState = {
  dueCards: number;
  hasDocuments: boolean;
  weakestTopic: { id: string; title: string } | null;
  planTopics: string[]; // topic ids planned for today
};

/** Picks today's three challenges from the student's situation (deterministic). */
export function pickChallenges(s: ChallengeState): ChallengeSpec[] {
  if (!s.hasDocuments) {
    return [
      { slot: 0, kind: "upload", target: 1, topicId: null, title: "Sube los apuntes de una asignatura" },
      { slot: 1, kind: "any_practice", target: 5, topicId: null, title: "Responde 5 preguntas o tarjetas" },
    ];
  }
  const out: ChallengeSpec[] = [];
  if (s.dueCards > 0) {
    const n = Math.min(15, Math.max(3, s.dueCards));
    out.push({ slot: 0, kind: "reviews", target: n, topicId: null, title: `Repasa ${n} tarjetas pendientes` });
  } else {
    out.push({ slot: 0, kind: "any_practice", target: 10, topicId: null, title: "Responde 10 preguntas o tarjetas" });
  }
  if (s.weakestTopic) {
    out.push({ slot: 1, kind: "weak_topic_quiz", target: 60, topicId: s.weakestTopic.id, title: `Supera el 60 % en «${s.weakestTopic.title}» (mín. 3 preguntas)` });
  }
  if (s.planTopics.length > 0) {
    const n = Math.min(2, s.planTopics.length);
    out.push({ slot: 2, kind: "plan_topics", target: n, topicId: null, title: `Practica ${n === 1 ? "el tema" : `${n} temas`} de tu plan de hoy` });
  }
  return out;
}

export type TodayEvidence = { topicId: string | null; kind: string; score: number }[];

/** Progress 0..target for a challenge, from today's evidence only (real activity). */
export function challengeProgress(c: ChallengeSpec, ev: TodayEvidence, uploadsToday: number, planTopics: string[]) {
  switch (c.kind) {
    case "upload":
      return Math.min(c.target, uploadsToday);
    case "reviews":
      return Math.min(c.target, ev.filter((e) => e.kind === "flashcard").length);
    case "any_practice":
      return Math.min(c.target, ev.length);
    case "weak_topic_quiz": {
      const items = ev.filter((e) => e.topicId === c.topicId && (e.kind === "mcq" || e.kind === "true_false"));
      if (items.length < 3) return 0;
      const pct = Math.round((items.reduce((a, e) => a + e.score, 0) / items.length) * 100);
      return Math.min(c.target, pct);
    }
    case "plan_topics": {
      const touched = new Set(ev.filter((e) => e.topicId && planTopics.includes(e.topicId)).map((e) => e.topicId));
      return Math.min(c.target, touched.size);
    }
  }
}

/* ---------------------------------- Badges --------------------------------- */

export type BadgeId =
  | "first_upload"
  | "first_mock"
  | "mock_improved"
  | "topic_mastered"
  | "gap_recovered"
  | "streak_7"
  | "streak_30"
  | "reviews_100"
  | "full_coverage"
  | "exam_ready";

export const BADGES: Record<BadgeId, { name: string; description: string }> = {
  first_upload: { name: "Primeros apuntes", description: "Sube tus primeros apuntes." },
  first_mock: { name: "Primer simulacro", description: "Completa un simulacro de examen." },
  mock_improved: { name: "Mejora real", description: "Saca más nota que en tu simulacro anterior." },
  topic_mastered: { name: "Tema dominado", description: "Alcanza el nivel «Dominado» en un tema." },
  gap_recovered: { name: "Laguna superada", description: "Recupera un tema en el que se detectó una laguna." },
  streak_7: { name: "Una semana constante", description: "Estudia 7 días seguidos (con 1 día de descanso permitido)." },
  streak_30: { name: "Un mes constante", description: "Mantén la constancia durante 30 días." },
  reviews_100: { name: "Memoria de hierro", description: "Completa 100 repasos de tarjetas." },
  full_coverage: { name: "Temario completo", description: "Trabaja todos los temas de una asignatura." },
  exam_ready: { name: "Lista/o para el examen", description: "Alcanza tu dominio objetivo antes de la fecha del examen." },
};

export type BadgeStats = {
  documents: number;
  mocks: number;
  mockImproved: boolean;
  topicsMastered: number;
  gapsRecovered: number;
  streak: number;
  reviews: number;
  fullCoverage: boolean;
  examReady: boolean;
};

export function earnedBadges(s: BadgeStats): BadgeId[] {
  const out: BadgeId[] = [];
  if (s.documents > 0) out.push("first_upload");
  if (s.mocks > 0) out.push("first_mock");
  if (s.mockImproved) out.push("mock_improved");
  if (s.topicsMastered > 0) out.push("topic_mastered");
  if (s.gapsRecovered > 0) out.push("gap_recovered");
  if (s.streak >= 7) out.push("streak_7");
  if (s.streak >= 30) out.push("streak_30");
  if (s.reviews >= 100) out.push("reviews_100");
  if (s.fullCoverage) out.push("full_coverage");
  if (s.examReady) out.push("exam_ready");
  return out;
}

/* ------------------------------ Mastery transitions ------------------------ */

const ORDER = ["not_started", "beginner", "developing", "almost", "mastered"] as const;
export type Level = (typeof ORDER)[number];

export type Transition = { topicId: string; from: Level; to: Level; gapBefore: boolean; gapAfter: boolean };

/** XP events (with idempotency keys) that a set of mastery transitions deserves. */
export function transitionRewards(ts: Transition[]) {
  const out: { kind: string; amount: number; key: string; topicId: string }[] = [];
  for (const t of ts) {
    const from = ORDER.indexOf(t.from);
    const to = ORDER.indexOf(t.to);
    // "beginner" is just having started: not an achievement.
    for (let l = Math.max(from + 1, 2); l <= to; l++) {
      const level = ORDER[l];
      out.push({
        kind: level === "mastered" ? "mastered" : "level_up",
        amount: level === "mastered" ? XP.mastered : XP.levelUp,
        key: `level:${t.topicId}:${level}`,
        topicId: t.topicId,
      });
    }
    if (t.gapBefore && !t.gapAfter) out.push({ kind: "gap_recovered", amount: XP.gapRecovered, key: `gap:${t.topicId}`, topicId: t.topicId });
  }
  return out;
}
