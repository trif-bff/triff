"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/(app)/actions";
import { Button, Input, Label } from "@/components/ui";

const LEVELS = ["ESO", "Bachillerato", "FP Grado Medio", "FP Grado Superior", "Universidad", "Oposiciones", "Formación no reglada", "Idiomas"];

export function SubjectForm({
  action,
  initial,
  submitLabel = "Crear asignatura",
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  initial?: { name: string; level: string | null; examDate: string | null; targetGrade: number | null; minutesPerDay: number; sourcesOnly: boolean };
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="name">Asignatura</Label>
        <Input id="name" name="name" required minLength={2} maxLength={80} defaultValue={initial?.name} placeholder="Ej.: Contabilidad financiera" />
      </div>
      <div>
        <Label htmlFor="level">Nivel académico</Label>
        <Input id="level" name="level" list="levels" defaultValue={initial?.level ?? ""} placeholder="Ej.: FP Grado Superior" />
        <datalist id="levels">{LEVELS.map((l) => <option key={l} value={l} />)}</datalist>
      </div>
      <div>
        <Label htmlFor="examDate">Fecha del examen</Label>
        <Input id="examDate" name="examDate" type="date" defaultValue={initial?.examDate ?? ""} />
      </div>
      <div>
        <Label htmlFor="targetGrade">Nota objetivo (0–10)</Label>
        <Input id="targetGrade" name="targetGrade" type="number" min={0} max={10} step={0.5} defaultValue={initial?.targetGrade ?? ""} />
      </div>
      <div>
        <Label htmlFor="minutesPerDay">Minutos de estudio al día</Label>
        <Input id="minutesPerDay" name="minutesPerDay" type="number" min={10} max={600} step={5} defaultValue={initial?.minutesPerDay ?? 60} />
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm sm:col-span-2">
        <input type="checkbox" name="sourcesOnly" defaultChecked={initial?.sourcesOnly ?? true} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
        <span>
          <span className="font-medium">Estudiar solo con mis apuntes</span>
          <span className="block text-ink-3">La tutora no añadirá contenido que no esté respaldado por tus documentos.</span>
        </span>
      </label>
      {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : submitLabel}</Button>
      </div>
    </form>
  );
}
