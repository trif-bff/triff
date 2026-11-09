import "server-only";

import { combineConfidence, type OcrPage } from "./ocr-parse";

/**
 * Document extraction. Output is a list of pages (PDF) or a single page
 * (DOCX/TXT/MD/image) of plain text. PDF pages without a text layer (scans)
 * and images (photos of notes) go through local OCR (see ocr.ts).
 */

export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** A PDF page with fewer characters than this is treated as scanned. */
const MIN_TEXT_PER_PAGE = 30;

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type OcrInfo = { pages: number; confidence: number | null; skippedPages: number };
export type Extracted = { pages: string[]; pageCount: number; ocr: OcrInfo | null };

/** Validate by magic bytes, not only by the client-provided MIME type. */
export function sniffType(buf: Uint8Array, declared: string, filename: string): string | null {
  const head = Buffer.from(buf.subarray(0, 5)).toString("latin1");
  if (head.startsWith("%PDF-")) return "pdf";
  if (buf[0] === 0x89 && head.slice(1, 4) === "PNG") return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  const riff = Buffer.from(buf.subarray(0, 12)).toString("latin1");
  if (riff.startsWith("RIFF") && riff.slice(8, 12) === "WEBP") return "webp";
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
      const pages = text.map(normalizeText);
      const scanned = pages.flatMap((p, i) => (p.length < MIN_TEXT_PER_PAGE ? [i + 1] : []));
      if (scanned.length === 0 || !(await ocrReady())) return { pages, pageCount: totalPages, ocr: null };
      const { ocrPdfPages, MAX_OCR_PAGES } = await import("./ocr");
      const results = await ocrPdfPages(buf, scanned);
      for (const [n, r] of results) pages[n - 1] = normalizeText(r.text);
      return { pages, pageCount: totalPages, ocr: ocrInfo([...results.values()], Math.max(0, scanned.length - MAX_OCR_PAGES)) };
    }
    case "png":
    case "jpg":
    case "webp": {
      if (!(await ocrReady())) return { pages: [""], pageCount: 1, ocr: null };
      const { ocrImage } = await import("./ocr");
      const r = await ocrImage(buf, kind);
      return { pages: [normalizeText(r.text)], pageCount: 1, ocr: ocrInfo([r], 0) };
    }
    case "docx": {
      const mammoth = await import("mammoth");
      // Convert to markdown-ish text keeping headings so topic detection works.
      const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(buf) });
      return { pages: [normalizeText(htmlToText(html))], pageCount: 1, ocr: null };
    }
    case "txt":
    case "md":
      return { pages: [normalizeText(new TextDecoder().decode(buf))], pageCount: 1, ocr: null };
    default:
      throw new Error(`Tipo no soportado: ${kind}`);
  }
}

async function ocrReady() {
  if (process.env.OCR_ENABLED === "false") return false;
  const { ocrAvailable } = await import("./ocr");
  return ocrAvailable();
}

function ocrInfo(results: OcrPage[], skippedPages: number): OcrInfo {
  return { pages: results.length, confidence: combineConfidence(results), skippedPages };
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
