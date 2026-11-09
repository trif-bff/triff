/**
 * Role-based access control for the admin panel (pure, unit-tested).
 * support = read-only staff (helpdesk); admin = full control.
 */
export const ROLES = ["student", "support", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const PLANS = ["free", "premium"] as const;
export type Plan = (typeof PLANS)[number];

export type Permission =
  | "admin.view" // overview, usage, errors (aggregated, no student content)
  | "users.view"
  | "users.manage" // role, plan, suspension
  | "settings.view"
  | "settings.manage"
  | "audit.view";

const GRANTS: Record<Role, readonly Permission[]> = {
  student: [],
  support: ["admin.view", "users.view", "settings.view", "audit.view"],
  admin: ["admin.view", "users.view", "users.manage", "settings.view", "settings.manage", "audit.view"],
};

export function isRole(x: string): x is Role {
  return (ROLES as readonly string[]).includes(x);
}

export function can(role: string, p: Permission) {
  return isRole(role) && GRANTS[role].includes(p);
}

export function isStaff(role: string) {
  return can(role, "admin.view");
}

export class ForbiddenError extends Error {
  status = 403;
}

/** Guards that keep the system administrable: no self-demotion/suspension, never remove the last admin. */
export function checkUserChange(opts: {
  actor: { id: string; role: string };
  target: { id: string; role: string };
  change: { role?: Role; banned?: boolean };
  adminCount: number;
}): string | null {
  const { actor, target, change, adminCount } = opts;
  if (!can(actor.role, "users.manage")) return "No tienes permiso para gestionar usuarios.";
  if (actor.id === target.id && (change.role !== undefined || change.banned)) return "No puedes cambiar tu propio rol ni suspender tu cuenta.";
  const losesAdmin = target.role === "admin" && ((change.role && change.role !== "admin") || change.banned);
  if (losesAdmin && adminCount <= 1) return "Debe quedar al menos un administrador activo.";
  return null;
}
