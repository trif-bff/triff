"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, GraduationCap, Layers, LogOut, Moon, Sparkles, Sun, Trophy } from "lucide-react";
import { useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/components/ui";

const LINKS = [
  { href: "/dashboard", label: "Hoy", icon: Sparkles },
  { href: "/subjects", label: "Asignaturas", icon: BookOpen },
  { href: "/tutor", label: "Tutora", icon: GraduationCap },
  { href: "/review", label: "Repaso", icon: Layers },
  { href: "/logros", label: "Logros", icon: Trophy },
];

export function Nav({ dueCount }: { dueCount: number }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 flex justify-around gap-1 border-t border-border bg-bg/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:flex-col md:justify-start md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
    >
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors md:flex-none md:flex-row md:gap-3 md:px-3 md:py-2 md:text-sm",
              active ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="h-4.5 w-4.5" aria-hidden />
            <span>{label}</span>
            {href === "/review" && dueCount > 0 && (
              <span className="absolute top-0 right-1/4 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white tabular-nums md:static md:ml-auto md:text-xs" aria-label={`${dueCount} tarjetas pendientes`}>
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
