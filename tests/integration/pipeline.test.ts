import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { aiUsage, chunks, documents, evidence, flashcards, planItems, quizQuestions, subjects, topics, user } from "@/db/schema";
import { retrieve } from "@/lib/rag/retrieve";
import { ingestDocument, UploadError } from "@/lib/services/documents";
import { generateFlashcards, generateQuiz } from "@/lib/services/generation";
import { recordEvidence, regeneratePlan, topicMastery } from "@/lib/services/progress";

const fixture = (f: string) => new Uint8Array(readFileSync(new URL(`../fixtures/${f}`, import.meta.url)));
const userId = `test-${randomUUID()}`;
const otherId = `test-${randomUUID()}`;
let subjectId: string;

beforeAll(async () => {
  delete process.env.ANTHROPIC_API_KEY; // integration tests never call paid APIs
  await db.insert(user).values([
    { id: userId, name: "Ana", email: `${userId}@example.com` },
    { id: otherId, name: "Otro", email: `${otherId}@example.com` },
  ]);
  const exam = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  [{ id: subjectId }] = await db.insert(subjects).values({ userId, name: "Contabilidad", examDate: exam, minutesPerDay: 60 }).returning({ id: subjects.id });
});

afterAll(async () => {
  await db.delete(user).where(eq(user.id, userId));
  await db.delete(user).where(eq(user.id, otherId));
  await pool.end();
});

describe("document pipeline", () => {
  it("ingests notes, builds topics and indexes chunks", async () => {
    const r = await ingestDocument({ userId, subjectId, filename: "contabilidad.md", declaredType: "text/markdown", bytes: fixture("contabilidad.md") });
    expect(r.chunks).toBeGreaterThanOrEqual(3);
    const ts = await db.select().from(topics).where(eq(topics.subjectId, subjectId));
    expect(ts.map((t) => t.title)).toEqual(["Tema 1. El patrimonio empresarial", "Tema 2. Los asientos contables", "Tema 3. La amortización"]);
    const [doc] = await db.select().from(documents).where(eq(documents.id, r.id));
    expect(doc.status).toBe("ready");
  });

  it("rejects duplicates and unsupported files", async () => {
    await expect(ingestDocument({ userId, subjectId, filename: "contabilidad.md", declaredType: "text/markdown", bytes: fixture("contabilidad.md") })).rejects.toBeInstanceOf(UploadError);
    await expect(ingestDocument({ userId, subjectId, filename: "x.exe", declaredType: "application/pdf", bytes: new Uint8Array([0x4d, 0x5a, 1, 2]) })).rejects.toThrow(/Formato no soportado/);
  });

  it("does not let another user ingest into this subject", async () => {
    await expect(ingestDocument({ userId: otherId, subjectId, filename: "a.md", declaredType: "text/markdown", bytes: fixture("injection.md") })).rejects.toThrow(/no encontrada/);
  });

  it("flags injected instructions as suspicious chunks", async () => {
    const r = await ingestDocument({ userId, subjectId, filename: "biologia.md", declaredType: "text/markdown", bytes: fixture("injection.md") });
    expect(r.injectionFlags).toBeGreaterThan(0);
    const cs = await db.select().from(chunks).where(eq(chunks.documentId, r.id));
    expect(cs.some((c) => c.suspicious)).toBe(true);
  });
});

describe("retrieval", () => {
  it("finds relevant passages with Spanish stemming and cites the file", async () => {
    const res = await retrieve({ userId, subjectId, query: "¿Qué es la partida doble en los asientos?" });
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].content).toMatch(/partida doble/);
    expect(res[0].filename).toBe("contabilidad.md");
  });
  it("is scoped to the owner", async () => {
    expect(await retrieve({ userId: otherId, subjectId, query: "partida doble" })).toEqual([]);
  });
});

describe("learning tools without AI", () => {
  it("generates flashcards linked to topics and is idempotent", async () => {
    const a = await generateFlashcards({ id: userId, role: "student" }, subjectId, {});
    expect(a.origin).toBe("heuristic");
    expect(a.created).toBeGreaterThanOrEqual(8);
    const b = await generateFlashcards({ id: userId, role: "student" }, subjectId, {});
    expect(b.created).toBe(0); // unique (subject, front)
    const cards = await db.select().from(flashcards).where(eq(flashcards.subjectId, subjectId));
    expect(cards.filter((c) => c.topicId).length).toBeGreaterThan(0);
    // No AI usage logged when running heuristically.
    expect(await db.select().from(aiUsage).where(eq(aiUsage.userId, userId))).toHaveLength(0);
  });

  it("generates a quiz restricted to one topic", async () => {
    const [t2] = await db.select().from(topics).where(and(eq(topics.subjectId, subjectId), eq(topics.normalizedTitle, "los asientos contables")));
    const r = await generateQuiz({ id: userId, role: "student" }, subjectId, { topicId: t2.id, count: 5 });
    expect(r.quizId).toBeTruthy();
    const qs = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, r.quizId!));
    expect(qs.length).toBeGreaterThanOrEqual(2);
    expect(qs.every((q) => q.topicId === t2.id)).toBe(true);
  });
});

describe("adaptive loop", () => {
  it("updates mastery from evidence and re-plans around gaps", async () => {
    await regeneratePlan(userId, subjectId);
    const before = await db.select().from(planItems).where(eq(planItems.subjectId, subjectId));
    expect(before.length).toBeGreaterThan(0);

    const [t3] = await db.select().from(topics).where(and(eq(topics.subjectId, subjectId), eq(topics.normalizedTitle, "la amortizacion")));
    await recordEvidence(Array.from({ length: 4 }, () => ({ userId, subjectId, topicId: t3.id, kind: "flashcard", score: 0 })));
    const tm = await topicMastery(userId, subjectId);
    const amort = tm.find((t) => t.id === t3.id)!;
    expect(amort.estimate.isGap).toBe(true);

    await regeneratePlan(userId, subjectId);
    const after = await db.select().from(planItems).where(eq(planItems.subjectId, subjectId));
    expect(after.some((p) => p.topicId === t3.id && /Laguna/.test(p.reason))).toBe(true);
    expect(await db.select().from(evidence).where(eq(evidence.userId, otherId))).toHaveLength(0);
  });
});
