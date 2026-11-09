import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { chunks, documents, subjects, topics, user } from "@/db/schema";
import { retrieve } from "@/lib/rag/retrieve";
import { ingestDocument } from "@/lib/services/documents";
import { generateFlashcards } from "@/lib/services/generation";

const fixture = (f: string) => new Uint8Array(readFileSync(new URL(`../fixtures/${f}`, import.meta.url)));
const userId = `test-${randomUUID()}`;
let subjectId: string;

beforeAll(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await db.insert(user).values({ id: userId, name: "Ana", email: `${userId}@example.com` });
  [{ id: subjectId }] = await db.insert(subjects).values({ userId, name: "Biología" }).returning({ id: subjects.id });
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
  await pool.end();
});

describe("OCR pipeline (local Tesseract)", () => {
  it("reads a photo of notes, detects the topic and reports confidence", async () => {
    const r = await ingestDocument({ userId, subjectId, filename: "foto.png", declaredType: "image/png", bytes: fixture("apuntes-foto.png") });
    expect(r.ocr?.pages).toBe(1);
    expect(r.ocr?.confidence).toBeGreaterThan(80);
    expect(r.ocr?.lowConfidence).toBe(false);
    const [doc] = await db.select().from(documents).where(eq(documents.id, r.id));
    expect(doc.ocrPages).toBe(1);
    const text = (await db.select().from(chunks).where(eq(chunks.documentId, r.id))).map((c) => c.content).join(" ");
    expect(text).toMatch(/mitocondria es el orgánulo/i);
    const ts = await db.select().from(topics).where(eq(topics.subjectId, subjectId));
    expect(ts.map((t) => t.normalizedTitle)).toContain("la celula");
  }, 60_000);

  it("OCRs only scanned PDF pages and keeps page numbers for citations", async () => {
    const r = await ingestDocument({ userId, subjectId, filename: "escaneado.pdf", declaredType: "application/pdf", bytes: fixture("apuntes-escaneados.pdf") });
    expect(r.pageCount).toBe(2);
    expect(r.ocr?.pages).toBe(2);
    const hits = await retrieve({ userId, subjectId, query: "¿Qué pigmento absorbe la luz?" });
    expect(hits[0].filename).toBe("escaneado.pdf");
    expect(hits[0].page).toBe(2);
    expect(hits[0].content).toMatch(/clorofila/i);
  }, 120_000);

  it("feeds OCR text into source-grounded study material", async () => {
    const res = await generateFlashcards({ id: userId, role: "student" }, subjectId, {});
    expect(res.created).toBeGreaterThanOrEqual(4);
  });

  it("also reads JPEG photos (text-layer PDFs skip OCR: covered by the E2E PDF test)", async () => {
    const r = await ingestDocument({ userId, subjectId, filename: "foto.jpg", declaredType: "image/jpeg", bytes: fixture("apuntes-foto.jpg") });
    expect(r.ocr?.pages).toBe(1);
    expect((await db.select().from(documents).where(and(eq(documents.subjectId, subjectId), eq(documents.ocrPages, 0)))).length).toBe(0);
  }, 60_000);

  it("rejects decompression bombs and blank images with clear messages", async () => {
    const bomb = new Uint8Array(fixture("apuntes-foto.png"));
    new DataView(bomb.buffer).setUint32(16, 60_000);
    await expect(ingestDocument({ userId, subjectId, filename: "bomba.png", declaredType: "image/png", bytes: bomb })).rejects.toThrow(/demasiado grande/);
    // A tiny valid 1x1 PNG has no text.
    const blank = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    await expect(ingestDocument({ userId, subjectId, filename: "blanco.png", declaredType: "image/png", bytes: blank })).rejects.toThrow(/foto más nítida/);
  }, 60_000);
});
