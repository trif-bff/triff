import { Card, Empty, SectionTitle } from "@/components/ui";
import { requirePermission } from "@/lib/auth/staff";
import { auditTrail, errorsReport } from "@/lib/services/admin";

export const metadata = { title: "Errores y auditoría" };

const ACTION: Record<string, string> = {
  "user.role_changed": "Cambio de rol",
  "user.plan_changed": "Cambio de plan",
  "user.suspended": "Cuenta suspendida",
  "user.reactivated": "Cuenta reactivada",
  "settings.updated": "Configuración actualizada",
  "document.ingested": "Documento procesado",
};
const fmt = (d: Date | string) => new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(d));

export default async function ErrorsPage() {
  const me = await requirePermission("audit.view");
  const [e, audit] = await Promise.all([errorsReport(me), auditTrail(me, { limit: 60, onlyAdmin: true })]);
  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-3xl font-semibold">Errores y auditoría</h1>
        <p className="text-sm text-ink-3">Para diagnosticar se muestran el nombre del archivo y el error, nunca su contenido.</p>
      </header>

      <section>
        <SectionTitle>Documentos que no se pudieron procesar</SectionTitle>
        {e.lowOcr > 0 && <p className="mb-3 text-sm text-ink-2">Además, {e.lowOcr} documento{e.lowOcr === 1 ? "" : "s"} con OCR de confianza baja (&lt; 70 %).</p>}
        {e.failedDocs.length === 0 ? (
          <Empty title="Ningún documento fallido" />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-border text-xs text-ink-3"><tr><th className="px-4 py-2.5 font-medium">Fecha</th><th className="px-4 py-2.5 font-medium">Usuario</th><th className="px-4 py-2.5 font-medium">Archivo</th><th className="px-4 py-2.5 font-medium">Error</th></tr></thead>
              <tbody>
                {e.failedDocs.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 tabular-nums">{fmt(d.created_at)}</td>
                    <td className="px-4 py-2.5">{d.email}</td>
                    <td className="px-4 py-2.5">{d.filename} <span className="text-xs text-ink-3">({d.mime_type})</span></td>
                    <td className="px-4 py-2.5 text-danger">{d.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Correos que no se pudieron enviar (30 días)</SectionTitle>
        {e.failedEmails.length === 0 ? (
          <Empty title="Sin fallos de envío" />
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-border text-sm">
              {e.failedEmails.map((m) => <li key={m.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5"><span>{m.kind} → {m.to}</span><span className="text-danger">{m.error}</span><span className="tabular-nums text-ink-3">{fmt(m.created_at)}</span></li>)}
            </ul>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Operaciones de IA fallidas (30 días)</SectionTitle>
        {e.failedAi.length === 0 ? (
          <Empty title="Sin fallos de IA" />
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-border text-sm">
              {e.failedAi.map((f) => <li key={`${f.feature}-${f.model}`} className="flex justify-between gap-4 px-4 py-2.5"><span>{f.feature} · {f.model}</span><span className="tabular-nums text-ink-3">{f.n} · última {fmt(f.last)}</span></li>)}
            </ul>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Auditoría de administración</SectionTitle>
        {audit.length === 0 ? (
          <Empty title="Sin acciones registradas" />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-border text-xs text-ink-3"><tr><th className="px-4 py-2.5 font-medium">Fecha</th><th className="px-4 py-2.5 font-medium">Quién</th><th className="px-4 py-2.5 font-medium">Acción</th><th className="px-4 py-2.5 font-medium">Detalle</th></tr></thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-2.5 tabular-nums">{fmt(a.createdAt)}</td>
                    <td className="px-4 py-2.5">{a.actorEmail ?? ((a.meta as { via?: string }).via === "cli" ? "línea de comandos" : "sistema")}</td>
                    <td className="px-4 py-2.5">{ACTION[a.action] ?? a.action}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-3">{summarize(a.action, a.meta as Record<string, unknown>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}

function summarize(action: string, meta: Record<string, unknown>) {
  if (action === "user.role_changed") return `${meta.from ?? "?"} → ${meta.to}`;
  if (action === "user.plan_changed") return `→ ${meta.to}`;
  if (action === "user.suspended") return meta.reason ? `Motivo: ${String(meta.reason)}` : "";
  if (action === "settings.updated") return "Ver valores anterior y nuevo en la base de datos (audit_log.meta)";
  return "";
}
