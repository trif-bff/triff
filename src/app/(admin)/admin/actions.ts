"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, PLANS, ROLES } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/auth/session";
import { setUserBanned, setUserPlan, setUserRole } from "@/lib/services/admin";
import { saveSettings } from "@/lib/services/settings";

export type AdminResult = { ok?: boolean; error?: string } | undefined;

const id = z.string().min(1).max(100);

async function actor() {
  const u = await requireUser();
  return { id: u.id, role: u.role };
}

export async function changeRole(targetId: string, role: string): Promise<AdminResult> {
  const a = await actor();
  const parsed = z.object({ targetId: id, role: z.enum(ROLES) }).safeParse({ targetId, role });
  if (!parsed.success) return { error: "Datos no válidos" };
  const r = await setUserRole(a, parsed.data.targetId, parsed.data.role);
  revalidatePath("/admin/users");
  return r;
}

export async function changePlan(targetId: string, plan: string): Promise<AdminResult> {
  const a = await actor();
  if (!can(a.role, "users.manage")) return { error: "No tienes permiso para gestionar usuarios." };
  const parsed = z.object({ targetId: id, plan: z.enum(PLANS) }).safeParse({ targetId, plan });
  if (!parsed.success) return { error: "Datos no válidos" };
  const r = await setUserPlan(a, parsed.data.targetId, parsed.data.plan);
  revalidatePath("/admin/users");
  return r;
}

export async function suspendUser(targetId: string, banned: boolean, reason?: string): Promise<AdminResult> {
  const a = await actor();
  const parsed = z.object({ targetId: id, banned: z.boolean(), reason: z.string().max(300).optional() }).safeParse({ targetId, banned, reason });
  if (!parsed.success) return { error: "Datos no válidos" };
  const r = await setUserBanned(a, parsed.data.targetId, parsed.data.banned, parsed.data.reason);
  revalidatePath("/admin/users");
  return r;
}

export async function updateSettings(_prev: AdminResult, form: FormData): Promise<AdminResult> {
  const a = await actor();
  if (!can(a.role, "settings.manage")) return { error: "Solo un administrador puede cambiar la configuración." };
  const num = (k: string) => Number(form.get(k));
  const str = (k: string) => {
    const v = String(form.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const prices: Record<string, { input: number; output: number }> = {};
  const models = form.getAll("price_model").map(String);
  const inputs = form.getAll("price_input").map(Number);
  const outputs = form.getAll("price_output").map(Number);
  models.forEach((m, i) => {
    const key = m.trim();
    if (key) prices[key] = { input: inputs[i], output: outputs[i] };
  });
  const provider = str("provider");
  const r = await saveSettings(a, {
    plans: { free: { aiDailyLimit: num("free_limit") }, premium: { aiDailyLimit: num("premium_limit") } },
    ai: { provider: provider as "anthropic" | "openai" | "google" | null, models: { tutor: str("model_tutor"), generation: str("model_generation") } },
    prices,
  });
  revalidatePath("/admin/settings");
  return "error" in r ? { error: r.error } : { ok: true };
}
