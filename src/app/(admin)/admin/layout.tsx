import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/logo";
import { requireStaff } from "@/lib/auth/staff";

export const metadata = { title: { default: "Administración", template: "%s · Admin · Triff" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-8">
          <Logo />
          <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">Admin</span>
          <AdminNav />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-ink-3 sm:inline">{me.email} · {me.role === "admin" ? "administrador" : "soporte (solo lectura)"}</span>
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> Volver a la app</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
