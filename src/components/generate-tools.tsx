"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Layers, ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

type Topic = { id: string; title: string };

export function GenerateTools({ subjectId, topics }: { subjectId: string; topics: Topic[] }) {
  const router = useRouter();
  const [topicId, setTopicId] = useState("");
  const [busy, setBusy] = useState<"cards" | "quiz" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(kind: "cards" | "quiz") {
    setBusy(kind);
    setMsg(null);
    const res = await fetch(`/api/subjects/${subjectId}/${kind === "cards" ? "flashcards" : "quizzes"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: topicId || null, count: kind === "cards" ? 15 : 10 }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMsg(data.error ?? "Error");
    const origin = data.origin === "heuristic" ? " (extracción literal de tus apuntes)" : data.origin === "ai" ? " (generado con IA a partir de tus apuntes)" : "";
    if (kind === "quiz" && data.quizId) return router.push(`/quiz/${data.quizId}`);
    setMsg(kind === "cards" ? `${data.created} tarjetas nuevas${origin}. ${data.message ?? ""}` : data.message ?? "No se pudo crear el cuestionario");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <select aria-label="Tema" value={topicId} onChange={(e) => setTopicId(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm">
        <option value="">Todo el temario</option>
        {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run("cards")} disabled={busy !== null} variant="secondary">
          {busy === "cards" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />} Generar flashcards
        </Button>
        <Button onClick={() => run("quiz")} disabled={busy !== null}>
          {busy === "quiz" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />} Generar cuestionario
        </Button>
      </div>
      {msg && <p role="status" className="text-sm text-ink-2">{msg}</p>}
    </div>
  );
}
