import Link from "next/link";
import { BarChart } from "@/components/admin/bar-chart";
import { Card, SectionTitle, cn } from "@/components/ui";
import { formatUsd } from "@/lib/admin/costs";
import { requireStaff } from "@/lib/auth/staff";
import { usageReport } from "@/lib/services/admin";

export const metadata = { title: "Consumo de IA" };

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const me = await requireStaff();
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const u = await usageReport(me, days);
  const ops = u.byModel.reduce((a, m) => a + m.ops, 0);
  const failed = u.byModel.reduce((a, m) => a + m.failed, 0);
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Consumo de IA</h1>
          <p className="text-sm text-ink-3">Coste estimado con los precios de la configuración. Las operaciones fallidas se registran pero no cuentan para los límites de los estudiantes.</p>
        </div>
        <nav aria-label="Periodo" className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`?days=${d}`} aria-current={d === days ? "page" : undefined} className={cn("rounded-lg px-3 py-1 text-sm", d === days ? "bg-surface font-medium shadow-sm" : "text-ink-3")}>{d} días</Link>
          ))}
        </nav>
      </header>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Totales">
        <Tile label="Operaciones" value={String(ops)} />
        <Tile label="Fallidas (no facturadas)" value={String(failed)} />
        <Tile label="Coste estimado" value={formatUsd(u.cost.total)} />
        <Tile label="Coste medio por operación" value={ops ? formatUsd(u.cost.total / ops) : "—"} />
      </section>
      {u.cost.unpriced.length > 0 && (
        <p role="note" className="rounded-xl bg-accent-soft px-4 py-2 text-sm">
          Modelos sin precio configurado (el coste es un mínimo): <strong>{u.cost.unpriced.join(", ")}</strong>. <Link className="text-primary underline" href="/admin/settings">Añadir precios</Link>
        </p>
      )}
      <Card>
        <BarChart title={`Operaciones por día (${days} días)`} unit="operaciones" data={u.byDay.map((d) => ({ label: d.day, value: d.ops, detail: d.failed ? `${d.failed} ${d.failed === 1 ? "fallida" : "fallidas"}` : "sin fallos" }))} />
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Por modelo</SectionTitle>
          <Table head={["Modelo", "Operaciones", "Tokens entrada / salida", "Coste"]} rows={u.byModel.map((m) => [`${m.model} (${m.provider})`, `${m.ops}${m.failed ? ` (${m.failed} fallidas)` : ""}`, `${m.input.toLocaleString("es-ES")} / ${m.output.toLocaleString("es-ES")}`, formatUsd(m.cost)])} />
        </section>
        <section>
          <SectionTitle>Por función</SectionTitle>
          <Table head={["Función", "Operaciones", "Fallidas"]} rows={u.byFeature.map((f) => [f.feature, String(f.ops), String(f.failed)])} />
        </section>
      </div>
      <section>
        <SectionTitle>Usuarios con más consumo facturable</SectionTitle>
        <Table head={["Usuario", "Operaciones", "Tokens entrada / salida"]} rows={u.topUsers.map((t) => [t.email, String(t.ops), `${t.input.toLocaleString("es-ES")} / ${t.output.toLocaleString("es-ES")}`])} />
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-ink-3">{label}</p>
    </Card>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs text-ink-3"><tr>{head.map((h, i) => <th key={h} className={cn("px-4 py-2.5 font-medium", i > 0 && "text-right")}>{h}</th>)}</tr></thead>
        <tbody className="tabular-nums">
          {rows.map((r, i) => <tr key={i} className="border-b border-border last:border-0">{r.map((c, j) => <td key={j} className={cn("px-4 py-2.5", j > 0 && "text-right")}>{c}</td>)}</tr>)}
          {rows.length === 0 && <tr><td colSpan={head.length} className="px-4 py-6 text-center text-ink-3">Sin datos en este periodo.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
