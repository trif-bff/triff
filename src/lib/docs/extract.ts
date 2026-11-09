import "server-only";

/**
 * Document extraction. Output is a list of pages (PDF) or a single page
 * (DOCX/TXT/MD) of plain text. OCR for scanned PDFs/images is a Phase-2
 * pipeline step (see PROJECT_ARCHITECTURE.md §RAG); here we detect and report
 * "no extractable text" instead of silently producing an empty index.
 */

export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
};

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type Extracted = { pages: string[]; pageCount: number };

/** Validate by magic bytes, not only by the client-provided MIME type. */
export function sniffType(buf: Uint8Array, declared: string, filename: string): string | null {
  const head = Buffer.from(buf.subarray(0, 5)).toString("latin1");
  if (head.startsWith("%PDF-")) return "pdf";
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  if (isZip && (declared.includes("wordprocessingml") || filename.toLowerCase().endsWith(".docx"))) return "docx";
  const lower = filename.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".txt") || declared.startsWith("text/")) {
    // Plain text must decode as UTF-8 and contain no NUL bytes.
    if (buf.includes(0)) return null;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
      return lower.endsWith(".md") ? "md" : "txt";
    } catch {
      return null;
    }
  }
  return null;
}

export async function extractDocument(buf: Uint8Array, kind: string): Promise<Extracted> {
  switch (kind) {
    case "pdf": {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { totalPages, text } = await extractText(pdf, { mergePages: false });
      return { pages: text.map(normalizeText), pageCount: totalPages };
    }
    case "docx": {
      const mammoth = await import("mammoth");
      // Convert to markdown-ish text keeping headings so topic detection works.
      const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(buf) });
      return { pages: [normalizeText(htmlToText(html))], pageCount: 1 };
    }
    case "txt":
    case "md":
      return { pages: [normalizeText(new TextDecoder().decode(buf))], pageCount: 1 };
    default:
      throw new Error(`Tipo no soportado: ${kind}`);
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<h([1-3])[^>]*>(.*?)<\/h\1>/gis, (_m, lvl, t) => `\n${"#".repeat(Number(lvl))} ${stripTags(t)}\n`)
    .replace(/<li[^>]*>(.*?)<\/li>/gis, (_m, t) => `\n- ${stripTags(t)}`)
    .replace(/<\/p>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, "").trim();
}

export function normalizeText(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/-\n(?=[a-záéíóúñ])/g, "") // de-hyphenate line breaks
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
