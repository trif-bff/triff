import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from "ts-fsrs";

/**
 * Spaced repetition with FSRS-6 (ts-fsrs). Chosen over SM-2 because FSRS models
 * stability/difficulty explicitly and needs ~20-30% fewer reviews for the same
 * retention in published benchmarks (open-spaced-repetition/srs-benchmark).
 */
export const DESIRED_RETENTION = 0.9;

const scheduler = fsrs(
  generatorParameters({ request_retention: DESIRED_RETENTION, enable_fuzz: true, maximum_interval: 365 }),
);

export type StoredCard = {
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
};

export const RATINGS = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy } as const;

export function isGrade(n: number): n is Grade {
  return n === Rating.Again || n === Rating.Hard || n === Rating.Good || n === Rating.Easy;
}

function toCard(c: StoredCard): Card {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduledDays,
    learning_steps: c.learningSteps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.lastReview ?? undefined,
  } as Card;
}

export function newCardState(now = new Date()): StoredCard {
  const c = createEmptyCard(now);
  return fromCard(c);
}

function fromCard(c: Card): StoredCard {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    lastReview: c.last_review ?? null,
  };
}

/**
 * Optional exam-aware cap: when an exam is close, never schedule the next review
 * after the exam day — a review after the exam has no value for this goal.
 */
export function review(card: StoredCard, grade: Grade, now = new Date(), examDate?: Date | null): StoredCard {
  const next = fromCard(scheduler.next(toCard(card), now, grade).card);
  if (examDate && next.due > examDate && examDate > now) {
    const capped = new Date(examDate.getTime() - 24 * 3600 * 1000);
    next.due = capped > now ? capped : examDate;
  }
  return next;
}

/** Probability the student still recalls the card right now (0..1). */
export function retrievability(card: StoredCard, now = new Date()): number {
  if (card.state === 0) return 0;
  return scheduler.retrievability(toCard(card), now);
}

/** Map a flashcard rating to a 0..1 evidence score for the mastery model. */
export function gradeToScore(grade: Grade): number {
  return { [Rating.Again]: 0, [Rating.Hard]: 0.6, [Rating.Good]: 0.85, [Rating.Easy]: 1 }[grade];
}
