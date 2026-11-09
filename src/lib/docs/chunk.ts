/**
 * Structure-aware chunking: detects headings (markdown, numbered sections,
 * "Tema N", short all-caps lines), keeps them as chunk metadata and splits
 * section bodies on paragraph/sentence boundaries with a small overlap.
 */

export type Chunk = { ordinal: number; page: number | null; heading: string | null; content: string };
export type Heading = { title: string; level: number; page: number | null };

const TARGET_CHARS = 1200;
const MAX_CHARS = 1800;
const OVERLAP_CHARS = 150;

const HEADING_PATTERNS: { re: RegExp; level: number }[] = [
  { re: /^(#{1,3})\s+(.{2,120})$/, level: 0 }, // level from # count
  { re: /^(?:tema|unidad|unit|bloque|cap[ií]tulo|m[oó]dulo)\s+\d+[.:\-–]?\s*(.{0,120})$/i, level: 1 },
  { re: /^(\d+)\.\s+([A-ZÁÉÍÓÚÑ].{2,100})$/, level: 1 },
  { re: /^(\d+\.\d+)\.?\s+([A-ZÁÉÍÓÚÑ].{2,100})$/, level: 2 },
];

export function detectHeading(line: string): { title: string; level: number } | null {
  const l = line.trim();
  if (l.length < 3 || l.length > 130) return null;
  for (const { re, level } of HEADING_PATTERNS) {
    const m = l.match(re);
    if (m) {
      if (level === 0) return { title: m[2].trim(), level: m[1].length };
      return { title: l.replace(/^#+\s*/, "").trim(), level };
    }
  }
  // Short ALL-CAPS line without final period: likely a section title.
  if (/^[A-ZÁÉÍÓÚÑÜ0-9 ,:;()\-–]{4,80}$/.test(l) && /[A-ZÁÉÍÓÚÑ]{3}/.test(l) && !l.endsWith(".")) {
    return { title: l.charAt(0) + l.slice(1).toLowerCase(), level: 1 };
  }
  return null;
}

function splitLong(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const sentences = text.match(/[^.!?\n]+[.!?]+["»)]?\s*|[^.!?\n]+\n*|\n+/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur.length + s.length > TARGET_CHARS && cur.length > 0) {
      out.push(cur.trim());
      cur = cur.slice(-OVERLAP_CHARS) + s; // overlap keeps context across boundaries
    } else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  // Hard split anything still too long (e.g. no punctuation).
  return out.flatMap((c) => (c.length > MAX_CHARS ? c.match(new RegExp(`[\\s\\S]{1,${TARGET_CHARS}}`, "g"))! : [c]));
}

export function chunkPages(pages: string[]): { chunks: Chunk[]; headings: Heading[] } {
  const chunks: Chunk[] = [];
  const headings: Heading[] = [];
  let heading: string | null = null;
  let buf = "";
  let bufPage: number | null = null;
  const multiPage = pages.length > 1;

  const flush = () => {
    const text = buf.trim();
    if (text.length >= 40) {
      for (const part of splitLong(text)) {
        chunks.push({ ordinal: chunks.length, page: bufPage, heading, content: part });
      }
    }
    buf = "";
  };

  pages.forEach((pageText, i) => {
    const page = multiPage ? i + 1 : null;
    for (const line of pageText.split("\n")) {
      const h = detectHeading(line);
      if (h) {
        flush();
        heading = h.title;
        headings.push({ ...h, page });
        bufPage = page;
        continue;
      }
      if (!buf) bufPage = page;
      buf += line + "\n";
      if (buf.length >= TARGET_CHARS) flush();
    }
    // Keep page attribution precise for PDFs.
    if (multiPage) flush();
  });
  flush();
  return { chunks, headings };
}

export function normalizeTitle(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(tema|unidad|unit|bloque|capitulo|modulo)\s+\d+[.:\-–]?\s*/, "")
    .replace(/^\d+(\.\d+)*\.?\s*/, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
