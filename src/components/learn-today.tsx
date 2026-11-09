"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Calculator, FileUp, GraduationCap, HelpCircle, Layers, ListChecks, MessageCircleQuestion } from "lucide-react";
import { cn } from "@/components/ui";

type Subject = { id: string; name: string };

export function LearnToday({ subjects }: { subjects: Subject[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState(subjects[0]?.id ?? "");
  const s = subject ? `&subject=${subject}` : "";

  const actions = [
    { label: "Preguntar a la tutora", icon: MessageCircleQuestion, href: `/tutor?mode=explain${s}` },
    { label: "Resolver un ejercicio", icon: Calculator, href: `/tutor?mode=solver${s}` },
    { label: "Modo socrático", icon: HelpCircle, href: `/tutor?mode=socratic${s}` },
    { label: "Practicar", icon: GraduationCap, href: `/tutor?mode=practice${s}` },
    { label: "Crear tarjetas", icon: Layers, href: subject ? `/subjects/${subject}#tools` : "/subjects" },
    { label: "Generar cuestionario", icon: ListChecks, href: subject ? `/subjects/${subject}#tools` : "/subjects" },
    { label: "Preparar un examen", icon: GraduationCap, href: "/subjects?new=1" },
    { label: "Subir documentos", icon: FileUp, href: subject ? `/subjects/${subject}#documents` : "/subjects?new=1" },
  ];

  return (
    <section aria-labelledby="learn-today" className="card overflow-hidden p-0">
      <div className="bg-gradient-to-br from-primary-soft via-surface to-accent-soft p-6 sm:p-8">
        <h2 id="learn-today" className="font-display text-2xl font-semibold sm:text-3xl">¿Qué quieres aprender hoy?</h2>
        <form
          className="mt-5 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push(`/tutor?mode=explain${s}&q=${encodeURIComponent(q.trim())}`);
          }}
        >
          {subjects.length > 0 && (
            <select
              aria-label="Asignatura"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-12 rounded-xl border border-border bg-surface px-3 text-sm sm:w-48"
            >
              {subjects.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
              <option value="">Sin asignatura</option>
            </select>
          )}
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej.: No entiendo los asientos contables de amortización"
              aria-label="Escribe lo que quieres aprender"
              className="h-12 w-full rounded-xl border border-border bg-surface pr-12 pl-4 text-base shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button type="submit" aria-label="Preguntar" className="absolute top-1.5 right-1.5 grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-ink disabled:opacity-40" disabled={!q.trim()}>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {actions.map(({ label, icon: Icon, href }) => (
          <button
            key={label}
            onClick={() => router.push(href)}
            className={cn("flex items-center gap-2.5 bg-surface px-4 py-3.5 text-left text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink")}
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
