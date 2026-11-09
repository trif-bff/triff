"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { Bar, Button, Card, buttonClass, cn } from "@/components/ui";
import type { ExamReport } from "@/lib/learning/exam-report";

type Q = { id: string; type: "mcq" | "true_false"; prompt: string; options: string[] };
type Result = { questionId: string; correct: boolean; correctOptions: number[]; explanation: string; selected?: number[] };
type Outcome = { score?: number; total?: number; report?: ExamReport; results: Result[] };

export type MockInfo = { deadline: string; limitSec: number };

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function QuizRunner({
  quiz,
  questions,
  previous,
  mock,
  initial,
}: {
  quiz: { id: string; title: string; subject: string; subjectId: string; origin: string };
  questions: Q[];
  previous: { score: number; total: number }[];
  mock?: MockInfo;
  initial?: Outcome | null;
}) {
  const [answers, setAnswers] = useState<Record<string, number[]>>(() =>
    Object.fromEntries((initial?.results ?? []).map((r) => [r.questionId, r.selected ?? []])),
  );
  const [outcome, setOutcome] = useState<Outcome | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const started = useRef(0);
  const submitting = useRef(false);
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers; // the auto-submit timer must read the latest answers
  }, [answers]);

  useEffect(() => {
    started.current = Date.now();
  }, []);

  const submit = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/quiz/${quiz.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: questions.map((q) => ({ questionId: q.id, selected: answersRef.current[q.id] ?? [] })),
        durationMs: Date.now() - started.current,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      submitting.current = false;
      return setError(data.error ?? "Error al corregir");
    }
    setOutcome(data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [quiz.id, questions]);

  // Countdown from the server-side deadline; auto-submits at zero.
  useEffect(() => {
    if (!mock || outcome) return;
    const deadline = new Date(mock.deadline).getTime();
    const tick = () => {
      const left = (deadline - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0) submit();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [mock, outcome, submit]);

  const byId = new Map(outcome?.results.map((r) => [r.questionId, r]));
  const answered = Object.values(answers).filter((a) => a.length).length;
  const isMock = Boolean(mock);
  const lowTime = remaining !== null && remaining <= 300;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-ink-3">
          {quiz.subject} · {isMock ? "simulacro de examen con preguntas de tus apuntes" : quiz.origin === "ai" ? "generado con IA desde tus apuntes" : "extraído de tus apuntes"}
        </p>
        <h1 className="font-display text-3xl font-semibold">{quiz.title}</h1>
        {isMock && !outcome && (
          <p className="mt-1 text-sm text-ink-2">
            {questions.length} preguntas · {Math.round(mock!.limitSec / 60)} minutos. Las respuestas y explicaciones se muestran al entregar. Al acabar el tiempo se entrega automáticamente.
          </p>
        )}
      </header>

      {outcome?.report ? (
        <MockReportView report={outcome.report} subjectId={quiz.subjectId} />
      ) : outcome ? (
        <Card className="rise flex flex-wrap items-center gap-4">
          <p className="font-display text-4xl font-semibold tabular-nums">{outcome.score}/{outcome.total}</p>
          <div className="flex-1 text-sm text-ink-2">
            <p>{outcome.score! / outcome.total! >= 0.8 ? "¡Muy bien! " : outcome.score! / outcome.total! >= 0.5 ? "Vas por buen camino. " : "Hay temas que reforzar. "}Tu dominio y tu plan se han actualizado.</p>
            {previous.length > 0 && <p className="text-ink-3">Intento anterior: {previous[0].score}/{previous[0].total}</p>}
          </div>
          <Link href={`/subjects/${quiz.subjectId}`} className={buttonClass("secondary", "sm")}>Ver mi progreso</Link>
        </Card>
      ) : null}

      <ol className="space-y-4">
        {questions.map((q, i) => {
          const r = byId.get(q.id);
          const sel = answers[q.id] ?? [];
          return (
            <li key={q.id}>
              <Card>
                <fieldset disabled={!!outcome}>
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
                {r && (
                  <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
                    {r.selected && r.selected.length === 0 && <span className="font-medium">Sin responder. </span>}
                    {r.explanation}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!outcome && (
        <div className="sticky bottom-4 card flex items-center justify-between gap-3 p-3">
          <span className="text-sm text-ink-3">{answered}/{questions.length} respondidas</span>
          {isMock && remaining !== null && (
            <span
              role="timer"
              aria-label={`Tiempo restante ${fmt(remaining)}`}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm tabular-nums", lowTime ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-2")}
            >
              <Clock className="h-4 w-4" aria-hidden /> {fmt(remaining)}
            </span>
          )}
          <Button onClick={submit} disabled={busy || (!isMock && answered === 0)}>{busy ? "Corrigiendo…" : "Entregar"}</Button>
        </div>
      )}
      {isMock && lowTime && !outcome && <p className="sr-only" aria-live="polite">Quedan menos de cinco minutos.</p>}
    </div>
  );
}

function MockReportView({ report, subjectId }: { report: ExamReport; subjectId: string }) {
  const passed = report.grade >= 5;
  return (
    <section aria-label="Informe del simulacro" className="space-y-4">
      <Card className="rise flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Nota orientativa</p>
          <p className={cn("font-display text-5xl font-semibold tabular-nums", passed ? "text-success" : "text-danger")}>{report.grade.toFixed(1)}</p>
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-sm text-ink-2">
          <p className="font-medium text-ink">{report.verdict}</p>
          <p>{report.answered}/{report.total} respondidas · tiempo usado {fmt(report.usedSec)} de {fmt(report.limitSec)}</p>
          {report.trend.delta !== null && report.trend.delta === 0 && <p className="text-ink-3">Igual que el simulacro anterior ({report.trend.previous!.toFixed(1)}).</p>}
          {report.trend.delta !== null && report.trend.delta !== 0 && (
            <p className={cn("inline-flex items-center gap-1", report.trend.delta > 0 ? "text-success" : "text-danger")}>
              {report.trend.delta > 0 ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />}
              {report.trend.delta > 0 ? "+" : ""}{report.trend.delta.toFixed(1)} respecto al simulacro anterior ({report.trend.previous!.toFixed(1)})
            </p>
          )}
          {report.late && (
            <p className="inline-flex items-center gap-1 text-accent"><AlertTriangle className="h-4 w-4" /> Entregado fuera de tiempo.</p>
          )}
        </div>
        <Link href={`/subjects/${subjectId}`} className={buttonClass("secondary", "sm")}>Ver mi plan</Link>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Resultado por tema</h2>
        <ul className="space-y-3">
          {report.byTopic.map((t) => (
            <li key={t.topicId ?? t.title}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="font-medium">{t.title}</span>
                <span className="tabular-nums text-ink-3">{t.correct}/{t.total}</span>
              </div>
              <Bar value={t.pct} />
            </li>
          ))}
        </ul>
        {report.weakest.length > 0 && (
          <div className="mt-5 border-t border-border pt-4 text-sm">
            <p className="mb-2 font-medium">Qué repasar antes del próximo simulacro</p>
            <ul className="space-y-1.5">
              {report.weakest.map((t) => (
                <li key={t.topicId ?? t.title}>
                  <Link className="text-primary hover:underline" href={`/tutor?subject=${subjectId}&mode=explain&q=${encodeURIComponent(`Explícame ${t.title}`)}`}>
                    {t.title}
                  </Link>{" "}
                  <span className="text-ink-3">— {Math.round(t.pct * 100)} % de aciertos</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-xs text-ink-3">La nota es orientativa: se calcula con preguntas generadas a partir de tus apuntes y no sustituye la evaluación de tu docente.</p>
      </Card>
    </section>
  );
}
