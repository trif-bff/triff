"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, GraduationCap, Layers, LogOut, Moon, Sparkles, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/components/ui";

const LINKS = [
  { href: "/dashboard", label: "Hoy", icon: Sparkles },
  { href: "/subjects", label: "Asignaturas", icon: BookOpen },
  { href: "/tutor", label: "Tutora", icon: GraduationCap },
  { href: "/review", label: "Repaso", icon: Layers },
];

export function Nav({ dueCount }: { dueCount: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="flex gap-1 md:flex-col">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="h-4.5 w-4.5" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
            {href === "/review" && dueCount > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-xs font-semibold text-white tabular-nums" aria-label={`${dueCount} tarjetas pendientes`}>
                {dueCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeTheme(cb: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", cb);
  window.addEventListener("themechange", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("themechange", cb);
  };
}

function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : window.matchMedia(DARK_QUERY).matches;
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false);
  function toggle() {
    const next = !isDark();
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
    window.dispatchEvent(new Event("themechange"));
  }
  return (
    <button onClick={toggle} className="rounded-xl p-2 text-ink-2 hover:bg-surface-2" aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
      {dark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button
      onClick={async () => { await authClient.signOut(); router.push("/login"); router.refresh(); }}
      className="rounded-xl p-2 text-ink-2 hover:bg-surface-2"
      aria-label="Cerrar sesión"
    >
      <LogOut className="h-4.5 w-4.5" />
    </button>
  );
}
