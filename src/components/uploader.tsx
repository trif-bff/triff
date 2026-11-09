"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, FileUp, Loader2 } from "lucide-react";
import { cn } from "@/components/ui";

export function Uploader({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({ kind: "idle" });
  const [drag, setDrag] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);
      setStatus({ kind: "busy", text: isImage || file.type === "application/pdf" ? `Procesando ${file.name}… (si es una foto o un escaneado, leerlo puede tardar un poco)` : `Procesando ${file.name}…` });
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/subjects/${subjectId}/documents`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", text: `${file.name}: ${data.error ?? "error"}` });
        return;
      }
      const ocr = data.ocr
        ? ` · texto reconocido en ${data.ocr.pages} página${data.ocr.pages === 1 ? "" : "s"} (confianza ${Math.round(data.ocr.confidence ?? 0)} %)` +
          (data.ocr.lowConfidence ? ". La lectura es dudosa: revisa que las tarjetas y respuestas tengan sentido o sube una foto más nítida" : "") +
          (data.ocr.skippedPages ? `. ${data.ocr.skippedPages} páginas superan el límite de OCR y no se han leído` : "")
        : "";
      setStatus({
        kind: data.ocr?.lowConfidence ? "error" : "ok",
        text: `${file.name}: ${data.chunks} fragmentos indexados${ocr}${data.injectionFlags ? ` · ${data.injectionFlags} con texto sospechoso (se tratará solo como dato)` : ""}.`,
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
        <span className="text-xs text-ink-3">PDF (también escaneados), DOCX, TXT, MD o fotos PNG/JPG/WEBP · máx. 15 MB</span>
      </button>
      <button
        type="button"
        onClick={() => camera.current?.click()}
        disabled={status.kind === "busy"}
        className="mt-2 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-primary hover:bg-primary-soft sm:hidden"
      >
        <Camera className="h-4 w-4" aria-hidden /> Hacer una foto de mis apuntes
      </button>
      <input ref={camera} type="file" hidden accept="image/*" capture="environment" onChange={(e) => upload(e.target.files)} />
      <input ref={input} type="file" multiple hidden accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg,image/webp" onChange={(e) => upload(e.target.files)} data-testid="file-input" />
      {status.text && (
        <p role="status" className={cn("mt-2 text-sm", status.kind === "error" ? "text-danger" : "text-ink-2")}>{status.text}</p>
      )}
    </div>
  );
}
