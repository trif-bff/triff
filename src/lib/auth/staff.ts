import "server-only";
import { notFound } from "next/navigation";
import { can, isStaff, type Permission } from "@/lib/admin/permissions";
import { requireUser } from "./session";

/** Staff-only pages answer 404 to everyone else (the panel's existence is not revealed). */
export async function requireStaff() {
  const u = await requireUser();
  if (!isStaff(u.role)) notFound();
  return u;
}

export async function requirePermission(p: Permission) {
  const u = await requireUser();
  if (!can(u.role, p)) notFound();
  return u;
}
