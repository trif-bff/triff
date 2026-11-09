export function Logo({ className = "" }: { className?: string }) {
  // Original mark: an open book whose pages form a rising light ray.
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--primary)" />
        <path d="M7 22c3-1.6 6-1.6 9 0 3-1.6 6-1.6 9 0V11c-3-1.6-6-1.6-9 0-3-1.6-6-1.6-9 0z" fill="none" stroke="var(--primary-ink)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M16 11v11" stroke="var(--primary-ink)" strokeWidth="1.8" />
        <circle cx="16" cy="6.5" r="2.2" fill="var(--accent)" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight">Triff</span>
    </span>
  );
}
