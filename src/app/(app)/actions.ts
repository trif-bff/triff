"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { planItems, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { regeneratePlan } from "@/lib/services/progress";

const subjectSchema = z.object({
  name: z.string().trim().min(2, "Pon un nombre a la asignatura").max(80),
  level: z.string().trim().max(60).optional().transform((v) => v || null),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).transform((v) => v || null),
  targetGrade: z.coerce.number().min(0).max(10).optional().or(z.literal("")).transform((v) => (v === "" || v === undefined ? null : Number(v))),
  minutesPerDay: z.coerce.number().int().min(10).max(600).default(60),
  sourcesOnly: z.preprocess((v) => v === "on", z.boolean()),
});

export type FormState = { error?: string } | undefined;

export async function createSubject(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = subjectSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const [s] = await db.insert(subjects).values({ ...parsed.data, userId: user.id }).returning({ id: subjects.id });
  redirect(`/subjects/${s.id}`);
}

export async function updateSubject(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = subjectSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  await db.update(subjects).set(parsed.data).where(and(eq(subjects.id, id), eq(subjects.userId, user.id)));
  await regeneratePlan(user.id, id);
  revalidatePath(`/subjects/${id}`);
  return {};
}

export async function deleteSubject(id: string) {
  const user = await requireUser();
  await db.delete(subjects).where(and(eq(subjects.id, id), eq(subjects.userId, user.id)));
  redirect("/subjects");
}

export async function togglePlanItem(id: string, done: boolean) {
  const user = await requireUser();
  await db.update(planItems).set({ done }).where(and(eq(planItems.id, id), eq(planItems.userId, user.id)));
  revalidatePath("/dashboard");
}

export async function rebuildPlan(subjectId: string) {
  const user = await requireUser();
  await regeneratePlan(user.id, subjectId);
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/dashboard");
}
