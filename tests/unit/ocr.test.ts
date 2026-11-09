import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sniffType } from "@/lib/docs/extract";
import { imageSize, imageTooLarge } from "@/lib/docs/image-size";
import { combineConfidence, parseTesseractTsv } from "@/lib/docs/ocr-parse";

const fixture = (f: string) => new Uint8Array(readFileSync(new URL(`../fixtures/${f}`, import.meta.url)));
const HEAD = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";
const w = (block: number, par: number, line: number, word: number, conf: number, text: string) =>
  `5\t1\t${block}\t${par}\t${line}\t${word}\t0\t0\t10\t10\t${conf}\t${text}`;

describe("Tesseract TSV parsing", () => {
  it("rebuilds lines and paragraphs and weights confidence by length", () => {
    const tsv = [
      HEAD,
      "1\t1\t0\t0\t0\t0\t0\t0\t100\t100\t-1\t",
      w(1, 1, 1, 1, 90, "Tema"),
      w(1, 1, 1, 2, 90, "1."),
      w(1, 1, 2, 1, 50, "La"),
      w(1, 1, 2, 2, 80, "célula"),
      w(1, 2, 1, 1, 100, "Fin"),
      w(1, 2, 1, 2, -1, ""),
    ].join("\n");
    const r = parseTesseractTsv(tsv);
    expect(r.text).toBe("Tema 1.\nLa célula\n\nFin");
    expect(r.words).toBe(5);
    expect(r.confidence).toBeCloseTo((90 * 4 + 90 * 2 + 50 * 2 + 80 * 6 + 100 * 3) / 17, 0);
  });
  it("returns empty text and zero confidence for blank pages", () => {
    expect(parseTesseractTsv(HEAD)).toEqual({ text: "", confidence: 0, words: 0 });
  });
  it("combines page confidences weighted by word count", () => {
    expect(combineConfidence([{ text: "", confidence: 90, words: 30 }, { text: "", confidence: 60, words: 10 }])).toBe(82.5);
    expect(combineConfidence([])).toBeNull();
  });
});

describe("image validation", () => {
  it("sniffs images by magic bytes", () => {
    expect(sniffType(fixture("apuntes-foto.png"), "application/pdf", "x.pdf")).toBe("png");
    expect(sniffType(fixture("apuntes-foto.jpg"), "", "x")).toBe("jpg");
    const webp = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBPVP8X")]);
    expect(sniffType(webp, "", "x.webp")).toBe("webp");
  });
  it("reads dimensions from PNG and JPEG headers", () => {
    expect(imageSize(fixture("apuntes-foto.png"))).toEqual({ width: 1000, height: 700 });
    expect(imageSize(fixture("apuntes-foto.jpg"))).toEqual({ width: 1000, height: 700 });
  });
  it("rejects decompression bombs before decoding", () => {
    const png = new Uint8Array(fixture("apuntes-foto.png"));
    const dv = new DataView(png.buffer);
    dv.setUint32(16, 50_000);
    dv.setUint32(20, 50_000);
    expect(imageTooLarge(imageSize(png)!)).toBe(true);
    expect(imageTooLarge({ width: 4032, height: 3024 })).toBe(false); // 12 MP phone photo
  });
  it("reads WEBP VP8X dimensions", () => {
    const b = new Uint8Array(30);
    b.set(new TextEncoder().encode("RIFF"), 0);
    b.set(new TextEncoder().encode("WEBPVP8X"), 8);
    b[24] = 0x9f; b[25] = 0x0f; // width-1 = 3999
    b[27] = 0xb7; b[28] = 0x0b; // height-1 = 2999 (0x0BB7)
    expect(imageSize(b)).toEqual({ width: 4000, height: 3000 });
  });
});
