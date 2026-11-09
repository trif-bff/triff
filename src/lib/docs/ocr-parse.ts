/**
 * Pure parsing of Tesseract TSV output (level, page, block, par, line, word,
 * left, top, width, height, conf, text). Rebuilds the text with line and
 * paragraph breaks (so heading detection keeps working) and computes a
 * length-weighted mean confidence (0–100).
 */

export type OcrPage = { text: string; confidence: number; words: number };

export const LOW_CONFIDENCE = 70;

export function parseTesseractTsv(tsv: string): OcrPage {
  const lines = tsv.split("\n").slice(1);
  const out: string[] = [];
  let lastPar = "";
  let lastLine = "";
  let current: string[] = [];
  let weighted = 0;
  let chars = 0;
  let words = 0;

  const flushLine = () => {
    if (current.length) out.push(current.join(" "));
    current = [];
  };

  for (const row of lines) {
    const cols = row.split("\t");
    if (cols.length < 12 || cols[0] !== "5") continue; // level 5 = word
    const text = cols.slice(11).join("\t").trim();
    const conf = Number(cols[10]);
    if (!text || !Number.isFinite(conf) || conf < 0) continue;
    const par = `${cols[1]}.${cols[2]}.${cols[3]}`;
    const line = `${par}.${cols[4]}`;
    if (line !== lastLine) {
      flushLine();
      if (lastPar && par !== lastPar) out.push(""); // paragraph break
      lastLine = line;
      lastPar = par;
    }
    current.push(text);
    weighted += conf * text.length;
    chars += text.length;
    words++;
  }
  flushLine();
  return {
    text: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    confidence: chars ? Math.round((weighted / chars) * 10) / 10 : 0,
    words,
  };
}

/** Mean confidence across pages, weighted by words. */
export function combineConfidence(pages: OcrPage[]): number | null {
  const w = pages.reduce((a, p) => a + p.words, 0);
  if (!w) return null;
  return Math.round((pages.reduce((a, p) => a + p.confidence * p.words, 0) / w) * 10) / 10;
}
