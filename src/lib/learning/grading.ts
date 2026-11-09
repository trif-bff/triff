/**
 * Objective grading for selected-response items.
 * Single-answer: 1 or 0. Multiple-answer: partial credit = (hits - wrong picks) / correct,
 * floored at 0, so selecting every option never scores.
 */
export function gradeAnswer(correct: number[], selected: number[]): number {
  const c = new Set(correct);
  const s = new Set(selected);
  if (s.size === 0) return 0;
  if (c.size === 1) return s.size === 1 && c.has([...s][0]) ? 1 : 0;
  let hits = 0;
  let wrong = 0;
  for (const x of s) {
    if (c.has(x)) hits++;
    else wrong++;
  }
  return Math.max(0, (hits - wrong) / c.size);
}
