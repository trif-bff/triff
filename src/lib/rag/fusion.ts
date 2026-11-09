/** Reciprocal Rank Fusion (Cormack et al., 2009): robust to incomparable score scales. */
export function reciprocalRankFusion<T extends { id: string }>(lists: T[][], k = 60): (T & { score: number })[] {
  const scores = new Map<string, { item: T; score: number }>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const prev = scores.get(item.id);
      const add = 1 / (k + rank + 1);
      if (prev) prev.score += add;
      else scores.set(item.id, { item, score: add });
    });
  }
  return [...scores.values()].sort((a, b) => b.score - a.score).map(({ item, score }) => ({ ...item, score }));
}
