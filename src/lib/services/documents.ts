import "server-only";
import { createHash } from "node:crypto";
import { embedMany } from "ai";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, chunks, documents, subjects, topics } from "@/db/schema";
import { getEmbeddingModel } from "@/lib/ai/provider";
import { chunkPages, normalizeTitle } from "@/lib/docs/chunk";
import { extractDocument, MAX_UPLOAD_BYTES, sniffType } from "@/lib/docs/extract";
import { imageSize, imageTooLarge } from "@/lib/docs/image-size";
import { scanForInjection } from "@/lib/docs/injection";
import { LOW_CONFIDENCE } from "@/lib/docs/ocr-parse";

export class UploadError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function getOwnedSubject(userId: string, subjectId: string) {
  const [s] = await db.select().from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)));
  return s ?? null;
}

/**
 * Pipeline: validate → dedupe → extract → chunk → injection scan → index (FTS
 * is a generated column) → embeddings (optional) → topics. Runs inline for the
 * MVP (files ≤ 15 MB); moves to a pg-boss worker in Phase 11.
 */
export async function ingestDocument(opts: {
  userId: string;
  subjectId: string;
  filename: string;
  declaredType: string;
  bytes: Uint8Array;
}) {
  const subject = await getOwnedSubject(opts.userId, opts.subjectId);
  if (!subject) throw new UploadError("Asignatura no encontrada", 404);
  if (opts.bytes.byteLength === 0) throw new UploadError("El archivo está vacío");
  if (opts.bytes.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("El archivo supera 15 MB", 413);

  const kind = sniffType(opts.bytes, opts.declaredType, opts.filename);
  if (!kind) throw new UploadError("Formato no soportado. Sube PDF, DOCX, TXT, MD o una foto (PNG, JPG, WEBP).", 415);
  const isImage = kind === "png" || kind === "jpg" || kind === "webp";
  if (isImage) {
    const size = imageSize(opts.bytes);
    if (!size) throw new UploadError("No se ha podido leer la imagen.", 415);
    if (imageTooLarge(size)) throw new UploadError("La imagen es demasiado grande (máx. 40 megapíxeles).", 413);
  }

  const filename = opts.filename.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 160) || "documento";
  const sha256 = createHash("sha256").update(opts.bytes).digest("hex");

  const [dup] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.subjectId, opts.subjectId), eq(documents.sha256, sha256)));
  if (dup) throw new UploadError("Este documento ya está en la asignatura", 409);

  const [doc] = await db
    .insert(documents)
    .values({
      subjectId: opts.subjectId,
      userId: opts.userId,
      filename,
      mimeType: opts.declaredType || kind,
      sizeBytes: opts.bytes.byteLength,
      sha256,
      status: "processing",
    })
    .returning();

  try {
    const { pages, pageCount, ocr } = await extractDocument(opts.bytes, kind);
    const charCount = pages.reduce((a, p) => a + p.length, 0);
    if (charCount < 50) {
      throw new UploadError(
        ocr
          ? "No se ha podido leer texto. Prueba con una foto más nítida, bien iluminada y con la hoja recta."
          : isImage || kind === "pdf"
            ? "No se ha podido extraer texto y el reconocimiento de texto (OCR) no está disponible en este servidor."
            : "No se ha podido extraer texto del documento.",
        422,
      );
    }
    const { chunks: parts, headings } = chunkPages(pages);
    let flags = 0;
    const rows = parts.map((c) => {
      const scan = scanForInjection(c.content);
      if (scan.suspicious) flags++;
      return { ...c, documentId: doc.id, subjectId: opts.subjectId, suspicious: scan.suspicious };
    });

    const inserted = rows.length
      ? await db.insert(chunks).values(rows).returning({ id: chunks.id, content: chunks.content, heading: chunks.heading })
      : [];

    await embedChunks(inserted);
    await upsertTopics(opts.subjectId, doc.id, filename, headings, parts);

    await db
      .update(documents)
      .set({ status: "ready", pageCount, charCount, injectionFlags: flags, ocrPages: ocr?.pages ?? 0, ocrConfidence: ocr?.confidence ?? null })
      .where(eq(documents.id, doc.id));
    await db.insert(auditLog).values({
      userId: opts.userId,
      action: "document.ingested",
      target: doc.id,
      meta: { chunks: inserted.length, flags, ocrPages: ocr?.pages ?? 0 },
    });
    return {
      id: doc.id,
      chunks: inserted.length,
      injectionFlags: flags,
      pageCount,
      ocr: ocr && { ...ocr, lowConfidence: ocr.confidence !== null && ocr.confidence < LOW_CONFIDENCE },
    };
  } catch (e) {
    const message = e instanceof UploadError ? e.message : "Error procesando el documento";
    if (!(e instanceof UploadError)) console.error("[ingest]", e);
    await db.update(documents).set({ status: "failed", error: message }).where(eq(documents.id, doc.id));
    throw e instanceof UploadError ? e : new UploadError(message, 500);
  }
}

async function embedChunks(rows: { id: string; content: string; heading: string | null }[]) {
  const em = getEmbeddingModel();
  if (!em || rows.length === 0) return;
  try {
    for (let i = 0; i < rows.length; i += 64) {
      const batch = rows.slice(i, i + 64);
      const { embeddings } = await embedMany({
        model: em.model,
        values: batch.map((r) => `${r.heading ?? ""}\n${r.content}`),
        providerOptions: { google: { outputDimensionality: 1536 } },
      });
      for (let j = 0; j < batch.length; j++) {
        await db.execute(sql`update chunks set embedding = ${`[${embeddings[j].join(",")}]`}::vector where id = ${batch[j].id}`);
      }
    }
  } catch (e) {
    // Retrieval degrades gracefully to full-text search.
    console.error("[ingest] embeddings failed; FTS only", e);
  }
}

async function upsertTopics(
  subjectId: string,
  documentId: string,
  filename: string,
  headings: { title: string; level: number; page: number | null }[],
  parts: { heading: string | null; content: string }[],
) {
  // Importance ≈ share of the material under each heading (more pages → more exam weight).
  const size = new Map<string, number>();
  for (const p of parts) {
    const key = normalizeTitle(p.heading ?? filename);
    size.set(key, (size.get(key) ?? 0) + p.content.length);
  }
  const total = [...size.values()].reduce((a, b) => a + b, 0) || 1;
  const candidates = headings.length
    ? headings.filter((h) => h.level <= 2)
    : [{ title: filename.replace(/\.[^.]+$/, ""), level: 1, page: null }];

  const [{ max }] = (
    await db.execute<{ max: number }>(sql`select coalesce(max(ordinal), -1) as max from topics where subject_id = ${subjectId}`)
  ).rows;
  let ordinal = Number(max) + 1;
  const seen = new Set<string>();
  for (const h of candidates) {
    const normalized = normalizeTitle(h.title);
    if (!normalized || seen.has(normalized)) continue; // duplicate detection within and across documents
    seen.add(normalized);
    const share = (size.get(normalized) ?? 0) / total;
    await db
      .insert(topics)
      .values({
        subjectId,
        title: h.title.slice(0, 140),
        normalizedTitle: normalized,
        ordinal: ordinal++,
        importance: Number((0.5 + Math.min(1.5, share * candidates.length)).toFixed(2)),
        sourceDocumentId: documentId,
        sourcePage: h.page,
      })
      .onConflictDoNothing();
  }
}

/** Map a chunk heading to the subject's topic id (by normalized title). */
export async function topicIndex(subjectId: string) {
  const rows = await db.select({ id: topics.id, n: topics.normalizedTitle }).from(topics).where(eq(topics.subjectId, subjectId));
  const map = new Map(rows.map((r) => [r.n, r.id]));
  return (heading: string | null, filename?: string) =>
    map.get(normalizeTitle(heading ?? "")) ?? (filename ? map.get(normalizeTitle(filename.replace(/\.[^.]+$/, ""))) : undefined) ?? null;
}
