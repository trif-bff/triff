import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./server";

export type SessionUser = { id: string; name: string; email: string; role: string; plan: string };

/** Data Access Layer entry point: every server read goes through here. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: string; plan?: string; banned?: boolean };
  if (u.banned) return null; // suspended accounts lose access immediately, even with a live cookie
  return { id: u.id, name: u.name, email: u.email, role: u.role ?? "student", plan: u.plan ?? "free" };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}
