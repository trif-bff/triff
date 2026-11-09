import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { LEVEL_LABEL, type MasteryLevel } from "@/lib/learning/mastery";

export function cn(...c: ClassValue[]) {
  return twMerge(clsx(c));
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" | "lg" = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
    size === "sm" && "h-8 px-3 text-sm",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-5 text-base",
    variant === "primary" && "bg-primary text-primary-ink hover:brightness-110 shadow-sm",
    variant === "secondary" && "bg-surface border border-border text-ink hover:bg-surface-2",
    variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
    variant === "danger" && "bg-danger text-white hover:brightness-110",
  );
}

export function Button({ variant, size, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  return <button className={cn(buttonClass(variant, size), className)} {...p} />;
}

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card p-5", className)} {...p} />;
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20", className)}
      {...p}
    />
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-2">
      {children}
    </label>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-3">{children}</h2>
      {action}
    </div>
  );
}

const LEVEL_STYLE: Record<MasteryLevel, string> = {
  not_started: "bg-[var(--m0)]/30 text-ink-2",
  beginner: "bg-[var(--m1)]/20 text-[var(--m1)]",
  developing: "bg-[var(--m2)]/20 text-[color-mix(in_oklab,var(--m2),var(--ink)_35%)]",
  almost: "bg-[var(--m3)]/20 text-[color-mix(in_oklab,var(--m3),var(--ink)_35%)]",
  mastered: "bg-[var(--m4)]/20 text-[var(--m4)]",
};
const LEVEL_DOTS: Record<MasteryLevel, number> = { not_started: 0, beginner: 1, developing: 2, almost: 3, mastered: 4 };

export function MasteryBadge({ level }: { level: MasteryLevel }) {
  const n = LEVEL_DOTS[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", LEVEL_STYLE[level])}>
      <span aria-hidden className="flex gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i < n ? "bg-current" : "bg-current opacity-25")} />
        ))}
      </span>
      {LEVEL_LABEL[level]}
    </span>
  );
}

export function ProgressRing({ value, size = 88, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Progreso"}: ${Math.round(v * 100)} %`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <span className="absolute text-lg font-semibold tabular-nums">{Math.round(v * 100)}%</span>
    </div>
  );
}

export function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-border p-8 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-3">{children}</div>}
    </div>
  );
}
