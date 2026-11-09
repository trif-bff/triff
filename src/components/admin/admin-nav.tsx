"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const LINKS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/users", label: "Usuarios" },
  { href: "/admin/usage", label: "Consumo de IA" },
  { href: "/admin/settings", label: "Configuración" },
  { href: "/admin/errors", label: "Errores y auditoría" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Administración" className="flex flex-wrap gap-1">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", active ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-surface-2")}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
