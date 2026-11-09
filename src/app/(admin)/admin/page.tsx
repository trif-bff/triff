import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, FileText, ScanText, UserPlus, Users, XCircle } from "lucide-react";
import { BarChart } from "@/components/admin/bar-chart";
import { Card, SectionTitle } from "@/components/ui";
import { formatUsd } from "@/lib/admin/costs";
import { requireStaff } from "@/lib/auth/staff";
import { overview, systemStatus, usageReport } from "@/lib/services/admin";

export const metadata = { title: "Resumen" };

export default async function AdminHome() {
  const me = await requireStaff();
  const [o, usage, sys] = await Promise.all([overview(me), usageReport(me, 30), systemStatus(me)]);
  const tiles = [
    { icon: Users, label: "Usuarios", value: o.users, hint: `${o.premium} premium · ${o.banned} suspendidos` },
    { icon: UserPlus, label: "Nuevos (7 días)", value: o.new_7d },
    { icon: CheckCircle2, label: "Activos (7 días)", value: o.active_7d, hint: "con actividad de estudio" },
    { icon: FileText, label: "Documentos", value: o.documents, hint: `${o.docs_ocr} con OCR · ${o.docs_failed} fallidos` },
    { icon: Bot, label: "Operaciones IA (30 días)", value: o.ai_ops_30d, hint: `${o.ai_ops_today} hoy · ${o.ai_failed_30d} fallidas` },
    { icon: ScanText, label: "Coste IA estimado (30 días)", value: formatUsd(o.cost30d.total), hint: o.cost30d.unpriced.length ? `sin precio: ${o.cost30d.unpriced.join(", ")}` : "precios de lista configurables" },
  ];
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold">Resumen</h1>
        <p className="text-sm text-ink-3">Solo datos agregados y metadatos: el contenido de los apuntes de los estudiantes no se muestra en este panel.</p>
      </header>
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map(({ icon: Icon, label, value, hint }) => (
          <Card key={label} className="p-4">
            <Icon className="mb-2 h-4 w-4 text-accent" aria-hidden />
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-sm text-ink-2">{label}</p>
            {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
          </Card>
        ))}
      </section>
      <Card>
        <BarChart
          title="Operaciones de IA por día (30 días)"
          unit="operaciones"
          data={usage.byDay.map((d) => ({ label: d.day, value: d.ops, detail: d.failed ? `${d.failed} ${d.failed === 1 ? "fallida" : "fallidas"} (no facturadas)` : "sin fallos" }))}
        />
      </Card>
      <section>
        <SectionTitle>Estado del sistema</SectionTitle>
        <Card className="grid gap-3 text-sm sm:grid-cols-2">
          <Status ok={sys.aiEnabled} label={`IA (${sys.activeProvider})`} detail={sys.aiEnabled ? `tutor: ${sys.models.tutor} · generación: ${sys.models.generation}` : "sin clave del proveedor: funciona en modo sin IA"} />
          <Status ok={sys.ocr} label="OCR local" detail={sys.ocr ? "Tesseract y pdftoppm disponibles" : "no disponible en este servidor"} />
          <Status ok={sys.embeddings !== "none"} label="Embeddings" detail={sys.embeddings === "none" ? "solo búsqueda de texto completo" : sys.embeddings} warn />
          <Status ok={o.docs_failed === 0} label="Documentos fallidos" detail={o.docs_failed ? <Link className="text-primary hover:underline" href="/admin/errors">{o.docs_failed} por revisar</Link> : "ninguno"} warn />
        </Card>
      </section>
    </div>
  );
}

function Status({ ok, label, detail, warn = false }: { ok: boolean; label: string; detail: React.ReactNode; warn?: boolean }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  return (
    <div className="flex items-start gap-2">
      <Icon className={ok ? "mt-0.5 h-4 w-4 text-success" : warn ? "mt-0.5 h-4 w-4 text-accent" : "mt-0.5 h-4 w-4 text-danger"} aria-hidden />
      <div>
        <p className="font-medium">{label} <span className="sr-only">{ok ? "correcto" : "atención"}</span></p>
        <p className="text-ink-3">{detail}</p>
      </div>
    </div>
  );
}
