"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bar, Button, Card } from "@/components/ui";

type C = { id: string; front: string; back: string; state: number; subject: string; topic: string | null; origin: string };

const GRADES = [
  { rating: 1, label: "Otra vez", key: "1", hint: "No la recordaba", cls: "border-danger/40 hover:bg-danger-soft" },
  { rating: 2, label: "Difícil", key: "2", hint: "Con mucho esfuerzo", cls: "border-accent/40 hover:bg-accent-soft" },
  { rating: 3, label: "Bien", key: "3", hint: "La recordé", cls: "border-success/40 hover:bg-success/10" },
  { rating: 4, label: "Fácil", key: "4", hint: "Inmediata", cls: "border-primary/40 hover:bg-primary-soft" },
];

export function ReviewSession({ cards }: { cards: C[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const [stats, setStats] = useState({ again: 0, ok: 0 });
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, []);
  const card = queue[0];

  async function grade(rating: number) {
    if (!card) return;
    const durationMs = Date.now() - started.current;
    const current = card;
    // "Otra vez" re-queues the card at the end of this session (short-term learning step).
    setQueue((q) => (rating === 1 ? [...q.slice(1), current] : q.slice(1)));
    setShown(false);
    setDone((d) => d + 1);
    setStats((s) => (rating === 1 ? { ...s, again: s.again + 1 } : { ...s, ok: s.ok + 1 }));
    started.current = Date.now();
    await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId: current.id, rating, durationMs: Math.min(durationMs, 600000) }) });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === " " && !shown) { e.preventDefault(); setShown(true); }
      if (shown && ["1", "2", "3", "4"].includes(e.key)) grade(Number(e.key));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    return (
      <Card className="rise text-center">
        <p className="font-display text-2xl font-semibold">Sesión terminada</p>
        <p className="mt-2 text-ink-2">{stats.ok} recordadas · {stats.again} a repasar de nuevo</p>
        <Button className="mt-5" onClick={() => router.refresh()}>Volver a comprobar</Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3 text-sm text-ink-3">
        <Bar value={done / (done + queue.length)} />
        <span className="shrink-0 tabular-nums">{queue.length} restantes</span>
      </div>
      <Card key={card.id + done} className="rise min-h-64 p-8">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-ink-3">
          {card.subject}{card.topic ? ` · ${card.topic}` : ""}{card.state === 0 ? " · nueva" : ""}
        </p>
        <p className="font-display text-2xl leading-snug">{card.front}</p>
        {shown && (
          <div className="rise mt-6 border-t border-border pt-6">
            <p className="text-lg text-ink-2">{card.back}</p>
            {card.origin === "heuristic" && <p className="mt-3 text-xs text-ink-3">Extraída literalmente de tus apuntes.</p>}
          </div>
        )}
      </Card>
      {!shown ? (
        <Button size="lg" className="w-full" onClick={() => setShown(true)}>Mostrar respuesta <kbd className="ml-2 text-xs opacity-70">espacio</kbd></Button>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="¿Qué tal la has recordado?">
          {GRADES.map((g) => (
            <button key={g.rating} onClick={() => grade(g.rating)} className={`rounded-xl border bg-surface px-3 py-3 text-left transition-colors ${g.cls}`}>
              <span className="block font-medium">{g.label} <kbd className="text-xs text-ink-3">{g.key}</kbd></span>
              <span className="text-xs text-ink-3">{g.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
