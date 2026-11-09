/**
 * Single-series bar chart (one measure over time). Thin bars with a rounded
 * data end anchored to the baseline, 2px gaps, recessive axis, hover/focus
 * tooltip per bar and an accessible table view. Server-renderable (CSS only).
 */
export type BarDatum = { label: string; value: number; detail?: string };

export function BarChart({ data, title, unit }: { data: BarDatum[]; title: string; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <figure>
      <figcaption className="mb-3 flex items-baseline justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-ink-3 tabular-nums">{total} {unit} en total · máx. {max}/día</span>
      </figcaption>
      {data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink-3">Sin datos en este periodo.</p>
      ) : (
        <div className="relative">
          <div className="flex h-40 items-end gap-[2px] border-b border-border" role="img" aria-label={`${title}: ${total} ${unit} en ${data.length} días`}>
            {data.map((d) => (
              <div key={d.label} className="group relative flex h-full flex-1 items-end" tabIndex={0} aria-label={`${d.label}: ${d.value} ${unit}${d.detail ? `, ${d.detail}` : ""}`}>
                <div className="w-full rounded-t-[4px] bg-primary/80 transition-colors group-hover:bg-primary group-focus:bg-primary" style={{ height: `${Math.max(d.value ? 2 : 0, (d.value / max) * 100)}%` }} />
                <div role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink shadow group-hover:block group-focus:block">
                  <span className="font-medium">{d.label}</span>
                  <span className="block tabular-nums text-ink-2">{d.value} {unit}{d.detail ? ` · ${d.detail}` : ""}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-ink-3 tabular-nums">
            <span>{data[0].label}</span>
            <span>{data[data.length - 1].label}</span>
          </div>
        </div>
      )}
      {data.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-3 hover:text-ink">Ver como tabla</summary>
          <table className="mt-2 w-full text-left">
            <thead className="text-xs text-ink-3"><tr><th className="py-1 font-medium">Día</th><th className="py-1 text-right font-medium">{unit}</th><th className="py-1 font-medium pl-4">Detalle</th></tr></thead>
            <tbody className="tabular-nums">
              {data.map((d) => <tr key={d.label} className="border-t border-border"><td className="py-1">{d.label}</td><td className="py-1 text-right">{d.value}</td><td className="py-1 pl-4 text-ink-3">{d.detail ?? ""}</td></tr>)}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}
