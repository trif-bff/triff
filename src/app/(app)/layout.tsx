import Link from "next/link";
import { Logo } from "@/components/logo";
import { Nav, SignOut, ThemeToggle } from "@/components/nav";
import { requireUser } from "@/lib/auth/session";
import { dueCards } from "@/lib/services/progress";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const due = await dueCards(user.id);
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-bg px-4 py-3 md:h-dvh md:flex-col md:items-stretch md:justify-start md:border-r md:border-b-0 md:px-4 md:py-6">
        <Link href="/dashboard" className="md:mb-8 md:px-2"><Logo /></Link>
        <Nav dueCount={due} />
        <div className="flex items-center gap-1 md:mt-auto md:border-t md:border-border md:pt-4">
          <div className="hidden min-w-0 flex-1 px-2 md:block">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-ink-3">{user.email}</p>
          </div>
          <ThemeToggle />
          <SignOut />
        </div>
      </aside>
      <main id="main" className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24 sm:px-8 sm:pt-10 md:pb-10">{children}</main>
    </div>
  );
}
