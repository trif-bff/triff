"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { cn } from "@/components/ui";

export function Uploader({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({ kind: "idle" });
  const [drag, setDrag] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      setStatus({ kind: "busy", text: `Procesando ${file.name}…` });
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/subjects/${subjectId}/documents`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", text: `${file.name}: ${data.error ?? "error"}` });
        return;
      }
      setStatus({
        kind: "ok",
        text: `${file.name}: ${data.chunks} fragmentos indexados${data.injectionFlags ? ` · ${data.injectionFlags} con texto sospechoso (se tratará solo como dato)` : ""}.`,
      });
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed p-8 text-center transition-colors",
          drag ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50",
        )}
        disabled={status.kind === "busy"}
      >
        {status.kind === "busy" ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <FileUp className="h-6 w-6 text-primary" />}
        <span className="font-medium">Arrastra tus apuntes o haz clic para subirlos</span>
        <span className="text-xs text-ink-3">PDF, DOCX, TXT o MD · máx. 15 MB · OCR de fotos y escaneados: próximamente</span>
      </button>
      <input ref={input} type="file" multiple hidden accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={(e) => upload(e.target.files)} data-testid="file-input" />
      {status.text && (
        <p role="status" className={cn("mt-2 text-sm", status.kind === "error" ? "text-danger" : "text-ink-2")}>{status.text}</p>
      )}
    </div>
  );
}
