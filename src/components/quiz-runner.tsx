"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button, Card, buttonClass, cn } from "@/components/ui";

type Q = { id: string; type: "mcq" | "true_false"; prompt: string; options: string[] };
type Result = { questionId: string; correct: boolean; correctOptions: number[]; explanation: string };

export function QuizRunner({ quiz, questions, previous }: { quiz: { id: string; title: string; subject: string; subjectId: string; origin: string }; questions: Q[]; previous: { score: number; total: number }[] }) {
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [results, setResults] = useState<{ score: number; total: number; results: Result[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, []);
  const byId = new Map(results?.results.map((r) => [r.questionId, r]));
  const answered = Object.values(answers).filter((a) => a.length).length;

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/quiz/${quiz.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: questions.map((q) => ({ questionId: q.id, selected: answers[q.id] ?? [] })), durationMs: Date.now() - started.current }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Error al corregir");
    setResults(data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-ink-3">{quiz.subject} · {quiz.origin === "ai" ? "generado con IA desde tus apuntes" : "extraído de tus apuntes"}</p>
        <h1 className="font-display text-3xl font-semibold">{quiz.title}</h1>
      </header>

      {results && (
        <Card className="rise flex flex-wrap items-center gap-4">
          <p className="font-display text-4xl font-semibold tabular-nums">{results.score}/{results.total}</p>
          <div className="flex-1 text-sm text-ink-2">
            <p>{results.score / results.total >= 0.8 ? "¡Muy bien! " : results.score / results.total >= 0.5 ? "Vas por buen camino. " : "Hay temas que reforzar. "}Tu dominio y tu plan se han actualizado.</p>
            {previous.length > 0 && <p className="text-ink-3">Intento anterior: {previous[0].score}/{previous[0].total}</p>}
          </div>
          <Link href={`/subjects/${quiz.subjectId}`} className={buttonClass("secondary", "sm")}>Ver mi progreso</Link>
        </Card>
      )}

      <ol className="space-y-4">
        {questions.map((q, i) => {
          const r = byId.get(q.id);
          const sel = answers[q.id] ?? [];
          return (
            <li key={q.id}>
              <Card>
                <fieldset disabled={!!results}>
                  <legend className="mb-3 font-medium"><span className="mr-2 text-ink-3 tabular-nums">{i + 1}.</span>{q.prompt}</legend>
                  <div className="grid gap-2">
                    {q.options.map((o, j) => {
                      const chosen = sel.includes(j);
                      const isCorrect = r?.correctOptions.includes(j);
                      return (
                        <label key={j} className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                          !r && (chosen ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"),
                          r && isCorrect && "border-success bg-success/10",
                          r && chosen && !isCorrect && "border-danger bg-danger-soft",
                          r && !chosen && !isCorrect && "border-border opacity-70",
                        )}>
                          <input type="radio" name={q.id} checked={chosen} onChange={() => setAnswers((a) => ({ ...a, [q.id]: [j] }))} className="accent-[var(--primary)]" />
                          <span className="flex-1">{o}</span>
                          {r && isCorrect && <CheckCircle2 className="h-4 w-4 text-success" aria-label="Correcta" />}
                          {r && chosen && !isCorrect && <XCircle className="h-4 w-4 text-danger" aria-label="Incorrecta" />}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                {r && <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">{r.explanation}</p>}
              </Card>
            </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!results && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 card p-3">
          <span className="text-sm text-ink-3">{answered}/{questions.length} respondidas</span>
          <Button onClick={submit} disabled={busy || answered === 0}>{busy ? "Corrigiendo…" : "Entregar"}</Button>
        </div>
      )}
    </div>
  );
}
