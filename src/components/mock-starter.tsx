"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Timer } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";

export function MockStarter({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [questions, setQuestions] = useState(20);
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/subjects/${subjectId}/mocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions, minutes }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "No se ha podido crear el simulacro");
    router.push(`/quiz/${data.quizId}`);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="mock-questions">Número de preguntas</Label>
          <Input id="mock-questions" type="number" min={5} max={40} value={questions} onChange={(e) => setQuestions(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="mock-minutes">Duración (minutos)</Label>
          <Input id="mock-minutes" type="number" min={5} max={180} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </div>
      </div>
      <p className="text-xs text-ink-3">Mezcla todos los temas según su peso. El tiempo empieza al pulsar y se entrega solo al terminar.</p>
      <Button onClick={start} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Timer className="h-4 w-4" />} Empezar simulacro
      </Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
