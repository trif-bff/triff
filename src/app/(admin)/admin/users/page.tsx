import Link from "next/link";
import { Search } from "lucide-react";
import { UserActions } from "@/components/admin/user-actions";
import { Input, buttonClass } from "@/components/ui";
import { can } from "@/lib/admin/permissions";
import { requirePermission } from "@/lib/auth/staff";
import { listUsers } from "@/lib/services/admin";

export const metadata = { title: "Usuarios" };

const ROLE: Record<string, string> = { student: "Estudiante", support: "Soporte", admin: "Administrador" };
const fmt = (d: Date | string | null) => (d ? new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(d)) : "—");

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const me = await requirePermission("users.view");
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const { rows, total, pageSize } = await listUsers(me, { q: sp.q, page });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const canManage = can(me.role, "users.manage");
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Usuarios</h1>
          <p className="text-sm text-ink-3">{total} cuentas. Suspender cierra todas las sesiones del usuario al instante. Todas las acciones quedan en la auditoría.</p>
        </div>
        <form className="flex gap-2" role="search">
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por nombre o correo" aria-label="Buscar usuarios" className="w-64" />
          <button className={buttonClass("secondary")} aria-label="Buscar"><Search className="h-4 w-4" /></button>
        </form>
      </header>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border text-xs text-ink-3">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Rol / plan</th>
              <th className="px-4 py-3 font-medium">Alta</th>
              <th className="px-4 py-3 font-medium">Última actividad</th>
              <th className="px-4 py-3 text-right font-medium">Docs</th>
              <th className="px-4 py-3 text-right font-medium">IA 30 d</th>
              <th className="px-4 py-3 text-right font-medium">XP</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.name} {u.id === me.id && <span className="text-xs text-ink-3">(tú)</span>}</p>
                  <p className="text-xs text-ink-3">{u.email}</p>
                  {u.banned && <span className="mt-1 inline-block rounded bg-danger-soft px-1.5 text-xs font-medium text-danger">Suspendido</span>}
                </td>
                <td className="px-4 py-3 text-ink-2">{ROLE[u.role] ?? u.role}<span className="block text-xs text-ink-3">{u.plan === "premium" ? "Premium" : "Gratuito"}</span></td>
                <td className="px-4 py-3 tabular-nums text-ink-2">{fmt(u.createdAt)}</td>
                <td className="px-4 py-3 tabular-nums text-ink-2">{fmt(u.lastActive)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.documents}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.aiOps30d}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.xp}</td>
                <td className="px-4 py-3"><UserActions u={u} canManage={canManage} isSelf={u.id === me.id} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-3">Sin resultados.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link className="text-primary hover:underline" href={`?q=${encodeURIComponent(sp.q ?? "")}&page=${page - 1}`}>Anterior</Link>}
          <span className="text-ink-3 tabular-nums">Página {page} de {pages}</span>
          {page < pages && <Link className="text-primary hover:underline" href={`?q=${encodeURIComponent(sp.q ?? "")}&page=${page + 1}`}>Siguiente</Link>}
        </nav>
      )}
    </div>
  );
}
