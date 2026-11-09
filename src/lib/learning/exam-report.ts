/**
 * Mock exam report: grade on the Spanish 0–10 scale, per-topic breakdown,
 * time usage and comparison with previous mocks. Pure, so it is unit-tested.
 */

export type ItemResult = { topicId: string | null; topicTitle: string | null; score: number; answered: boolean };

export type TopicResult = { topicId: string | null; title: string; correct: number; total: number; pct: number };

export type ExamReport = {
  grade: number; // 0..10, one decimal
  answered: number;
  total: number;
  byTopic: TopicResult[];
  weakest: TopicResult[];
  trend: { previous: number | null; delta: number | null };
  late: boolean;
  usedSec: number;
  limitSec: number;
  verdict: string;
};

export const LATE_GRACE_SEC = 30;

export function isLate(startedAt: Date, limitSec: number, submittedAt: Date) {
  return submittedAt.getTime() - startedAt.getTime() > (limitSec + LATE_GRACE_SEC) * 1000;
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function buildExamReport(opts: {
  items: ItemResult[];
  previousGrades: number[]; // most recent first
  startedAt: Date;
  submittedAt: Date;
  limitSec: number;
  targetGrade?: number | null;
}): ExamReport {
  const { items } = opts;
  const total = items.length;
  const points = items.reduce((a, i) => a + i.score, 0);
  const grade = total ? round1((points / total) * 10) : 0;

  const groups = new Map<string, TopicResult>();
  for (const i of items) {
    const key = i.topicId ?? "_general";
    const g = groups.get(key) ?? { topicId: i.topicId, title: i.topicTitle ?? "General", correct: 0, total: 0, pct: 0 };
    g.correct += i.score;
    g.total += 1;
    groups.set(key, g);
  }
  const byTopic = [...groups.values()]
    .map((g) => ({ ...g, correct: round1(g.correct), pct: g.total ? g.correct / g.total : 0 }))
    .sort((a, b) => a.pct - b.pct);
  const weakest = byTopic.filter((t) => t.pct < 0.6).slice(0, 3);

  const previous = opts.previousGrades[0] ?? null;
  const usedSec = Math.max(0, Math.round((opts.submittedAt.getTime() - opts.startedAt.getTime()) / 1000));
  const target = opts.targetGrade ?? 5;
  const verdict =
    grade >= target
      ? `Has alcanzado tu objetivo (${target}).`
      : grade >= 5
        ? `Aprobado, a ${round1(target - grade)} puntos de tu objetivo.`
        : `Por debajo del aprobado: céntrate en los temas más débiles antes del próximo simulacro.`;

  return {
    grade,
    answered: items.filter((i) => i.answered).length,
    total,
    byTopic,
    weakest,
    trend: { previous, delta: previous === null ? null : round1(grade - previous) },
    late: isLate(opts.startedAt, opts.limitSec, opts.submittedAt),
    usedSec,
    limitSec: opts.limitSec,
    verdict,
  };
}
