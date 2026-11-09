"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { cn } from "@/components/ui";
import { EXPLAIN_STYLES, MODE_LABEL, TUTOR_MODES, type TutorMode } from "@/lib/ai/prompts";

type Citation = { n: number; chunkId: string; filename: string; page: number | null };
type Msg = { role: "user" | "assistant"; content: string; citations?: Citation[]; image?: string };

const MODE_HINT: Record<TutorMode, string> = {
  explain: "Te explico cualquier concepto y compruebo que lo has entendido.",
  solver: "Pega o fotografía un ejercicio: lo resolvemos paso a paso y lo comprobamos.",
  socratic: "No te daré la respuesta: te guiaré con preguntas hasta que la encuentres.",
  practice: "Te propongo ejercicios a tu nivel y te corrijo cada respuesta.",
};

export function TutorChat(props: { subjects: { id: string; name: string }[]; initialSubject: string; initialMode: TutorMode; initialQuestion: string; aiEnabled: boolean }) {
  const [subject, setSubject] = useState(props.initialSubject);
  const [mode, setMode] = useState<TutorMode>(props.initialMode);
  const [style, setStyle] = useState<string>("");
  const [input, setInput] = useState(props.initialQuestion);
  const [image, setImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function reset() {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    const sentImage = image;
    setImage(null);
    setMessages((m) => [...m, { role: "user", content: text, image: sentImage ?? undefined }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, subjectId: subject || null, mode, style: style || null, message: text, image: sentImage }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se ha podido contactar con la tutora");
      }
      setConversationId(res.headers.get("X-Conversation-Id"));
      const raw = res.headers.get("X-Citations");
      const cites: Citation[] = raw ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)))) : [];
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc, citations: cites }]);
      }
      if (!acc) throw new Error("La tutora no ha respondido. Inténtalo de nuevo.");
    } catch (err) {
      setError((err as Error).message);
      setMessages((m) => (m.at(-1)?.content === "" ? m.slice(0, -1) : m));
    } finally {
      setBusy(false);
    }
  }

  function onImage(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 4 * 1024 * 1024) {
      setError("La imagen debe ser PNG, JPG o WEBP y ocupar menos de 4 MB.");
      return;
    }
    const r = new FileReader();
    r.onload = () => setImage(String(r.result));
    r.readAsDataURL(f);
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <header className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold">Tutora</h1>
          <div className="flex items-center gap-2">
            <select aria-label="Asignatura" value={subject} onChange={(e) => { setSubject(e.target.value); reset(); }} className="h-9 rounded-xl border border-border bg-surface px-3 text-sm">
              {props.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="">Sin asignatura</option>
            </select>
            {messages.length > 0 && (
              <button onClick={reset} className="rounded-xl p-2 text-ink-2 hover:bg-surface-2" aria-label="Nueva conversación"><RotateCcw className="h-4 w-4" /></button>
            )}
          </div>
        </div>
        <div role="tablist" aria-label="Modo de aprendizaje" className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
          {TUTOR_MODES.map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink")}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-3">{MODE_HINT[mode]}</p>
        {mode === "explain" && (
          <div className="flex flex-wrap gap-1.5" aria-label="Estilo de explicación">
            {EXPLAIN_STYLES.map((s) => (
              <button key={s} onClick={() => setStyle(style === s ? "" : s)} aria-pressed={style === s} className={cn("rounded-full border px-3 py-1 text-xs", style === s ? "border-primary bg-primary-soft text-primary" : "border-border text-ink-2 hover:border-primary/40")}>
                {s}
              </button>
            ))}
          </div>
        )}
        {!props.aiEnabled && (
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-ink-2">
            Modo sin IA: falta configurar un proveedor. La tutora mostrará los fragmentos más relevantes de tus apuntes con su referencia.
          </p>
        )}
      </header>

      <div className="flex-1 space-y-5 pb-4" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={cn("rise flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[92%] rounded-2xl px-4 py-3", m.role === "user" ? "bg-primary text-primary-ink" : "card")}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              {m.image && <img src={m.image} alt="Imagen enviada" className="mb-2 max-h-48 rounded-lg" />}
              {m.role === "assistant" ? (
                m.content ? <Markdown>{m.content}</Markdown> : <Loader2 className="h-4 w-4 animate-spin text-ink-3" aria-label="Pensando" />
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
              {m.citations && m.citations.length > 0 && m.content && (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="mb-1 text-xs font-semibold text-ink-3">Fuentes de tus apuntes</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {m.citations.map((c) => (
                      <li key={c.n} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2">[{c.n}] {c.filename}{c.page ? `, p. ${c.page}` : ""}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <p role="alert" className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <form onSubmit={send} className="sticky bottom-3 card flex flex-col gap-2 p-2">
        {image && (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
            <img src={image} alt="Imagen adjunta" className="h-16 rounded-lg" />
            <button type="button" onClick={() => setImage(null)} className="absolute -top-2 -right-2 rounded-full bg-ink p-0.5 text-bg" aria-label="Quitar imagen"><X className="h-3 w-3" /></button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl p-2.5 text-ink-2 hover:bg-surface-2" aria-label="Adjuntar foto de un ejercicio" disabled={!props.aiEnabled}>
            <ImagePlus className="h-5 w-5" />
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onImage(e.target.files?.[0])} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) send(e); }}
            rows={1}
            maxLength={6000}
            placeholder={mode === "solver" ? "Escribe o pega el enunciado…" : "Escribe tu pregunta…"}
            aria-label="Mensaje para la tutora"
            className="max-h-48 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base focus:outline-none"
          />
          <button type="submit" disabled={busy || !input.trim()} className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-ink disabled:opacity-40" aria-label="Enviar">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
