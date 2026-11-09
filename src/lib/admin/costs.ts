/** Cost estimation from token usage and a price table (USD per million tokens). Pure. */
export type UsageRow = { model: string; inputTokens: number; outputTokens: number };
export type PriceTable = Record<string, { input: number; output: number }>;

export function costOf(row: UsageRow, prices: PriceTable): number | null {
  const p = prices[row.model];
  if (!p) return null;
  return (row.inputTokens * p.input + row.outputTokens * p.output) / 1_000_000;
}

/** Sums known costs and reports which models had no price (so the total is a lower bound). */
export function estimateCost(rows: UsageRow[], prices: PriceTable) {
  let total = 0;
  const unpriced = new Set<string>();
  for (const r of rows) {
    const c = costOf(r, prices);
    if (c === null) {
      if (r.inputTokens + r.outputTokens > 0) unpriced.add(r.model);
    } else total += c;
  }
  return { total: Math.round(total * 10000) / 10000, unpriced: [...unpriced].sort() };
}

export function formatUsd(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD", minimumFractionDigits: n < 1 ? 4 : 2, maximumFractionDigits: n < 1 ? 4 : 2 }).format(n);
}
