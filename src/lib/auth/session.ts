import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./server";

export type SessionUser = { id: string; name: string; email: string; role: string };

/** Data Access Layer entry point: every server read goes through here. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: string };
  return { id: u.id, name: u.name, email: u.email, role: u.role ?? "student" };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}
