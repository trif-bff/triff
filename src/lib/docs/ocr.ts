import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { parseTesseractTsv, type OcrPage } from "./ocr-parse";

/**
 * Local OCR with Tesseract 5 (spa+cat+eng) — no external service, no cost, the
 * student's files never leave our servers. Scanned PDF pages are rasterised
 * with poppler's `pdftoppm` (only pages without a text layer).
 *
 * Safety: binaries are invoked with execFile (no shell), fixed arguments, a
 * per-page timeout and a page cap; temp files live in a private mkdtemp dir that
 * is always removed.
 *
 * Handwriting: Tesseract is designed for print. Handwritten notes are accepted,
 * but low confidence is reported to the student; the vision model of the AI
 * provider will be used for them when one is configured.
 */

const run = promisify(execFile);

export const OCR_LANGS = process.env.OCR_LANGS ?? "spa+cat+eng";
export const MAX_OCR_PAGES = Number(process.env.OCR_MAX_PAGES ?? 25);
const PAGE_TIMEOUT_MS = 60_000;
const DPI = 200;

let available: Promise<boolean> | null = null;
export function ocrAvailable() {
  available ??= Promise.all([run("tesseract", ["--version"]), run("pdftoppm", ["-v"])])
    .then(() => true)
    .catch(() => false);
  return available;
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "triff-ocr-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function tesseract(imagePath: string): Promise<OcrPage> {
  const { stdout } = await run("tesseract", [imagePath, "stdout", "-l", OCR_LANGS, "--psm", "3", "tsv"], {
    timeout: PAGE_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, OMP_THREAD_LIMIT: "1" }, // predictable CPU use per request
  });
  return parseTesseractTsv(stdout);
}

export async function ocrImage(bytes: Uint8Array, ext: "png" | "jpg" | "webp"): Promise<OcrPage> {
  return withTempDir(async (dir) => {
    const file = path.join(dir, `input.${ext}`);
    await writeFile(file, bytes);
    return tesseract(file);
  });
}

/** OCR the given 1-based PDF pages. Returns a map page → result. */
export async function ocrPdfPages(bytes: Uint8Array, pages: number[]): Promise<Map<number, OcrPage>> {
  const out = new Map<number, OcrPage>();
  if (pages.length === 0) return out;
  return withTempDir(async (dir) => {
    const pdf = path.join(dir, "input.pdf");
    await writeFile(pdf, bytes);
    for (const n of pages.slice(0, MAX_OCR_PAGES)) {
      const prefix = path.join(dir, `p${n}`);
      await run("pdftoppm", ["-r", String(DPI), "-f", String(n), "-l", String(n), "-png", "-singlefile", pdf, prefix], {
        timeout: PAGE_TIMEOUT_MS,
      });
      out.set(n, await tesseract(`${prefix}.png`));
      await rm(`${prefix}.png`, { force: true });
    }
    // Defensive: nothing else should be left behind.
    for (const f of await readdir(dir)) if (f !== "input.pdf") await rm(path.join(dir, f), { force: true });
    return out;
  });
}
