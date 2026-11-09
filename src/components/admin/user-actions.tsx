"use client";

import { useState, useTransition } from "react";
import { changePlan, changeRole, suspendUser } from "@/app/(admin)/admin/actions";
import { cn } from "@/components/ui";

type U = { id: string; email: string; role: string; plan: string; banned: boolean };

export function UserActions({ u, canManage, isSelf }: { u: U; canManage: boolean; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string } | undefined>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r?.error) setError(r.error);
    });

  if (!canManage) return <span className="text-xs text-ink-3">Solo lectura</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`Rol de ${u.email}`}
        defaultValue={u.role}
        disabled={pending || isSelf}
        onChange={(e) => run(() => changeRole(u.id, e.target.value))}
        className="h-8 rounded-lg border border-border bg-surface px-2 text-xs"
      >
        <option value="student">Estudiante</option>
        <option value="support">Soporte</option>
        <option value="admin">Administrador</option>
      </select>
      <select
        aria-label={`Plan de ${u.email}`}
        defaultValue={u.plan}
        disabled={pending}
        onChange={(e) => run(() => changePlan(u.id, e.target.value))}
        className="h-8 rounded-lg border border-border bg-surface px-2 text-xs"
      >
        <option value="free">Gratuito</option>
        <option value="premium">Premium</option>
      </select>
      {!isSelf && (
        <button
          disabled={pending}
          onClick={() => {
            if (u.banned) return run(() => suspendUser(u.id, false));
            const reason = window.prompt(`¿Suspender a ${u.email}? Se cerrarán todas sus sesiones. Motivo (opcional):`);
            if (reason !== null) run(() => suspendUser(u.id, true, reason || undefined));
          }}
          className={cn("h-8 rounded-lg px-2.5 text-xs font-medium", u.banned ? "bg-success/10 text-success" : "bg-danger-soft text-danger")}
        >
          {u.banned ? "Reactivar" : "Suspender"}
        </button>
      )}
      {error && <p role="alert" className="basis-full text-xs text-danger">{error}</p>}
    </div>
  );
}
