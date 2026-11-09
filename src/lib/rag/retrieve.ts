import "server-only";
import { embed } from "ai";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getEmbeddingModel } from "@/lib/ai/provider";
import { reciprocalRankFusion } from "./fusion";

export type Retrieved = {
  id: string;
  content: string;
  heading: string | null;
  page: number | null;
  filename: string;
  documentId: string;
  suspicious: boolean;
  score: number;
};

/**
 * Hybrid retrieval: Postgres full-text search (Spanish stemming) fused with
 * pgvector cosine similarity using Reciprocal Rank Fusion. Works with FTS only
 * when no embeddings provider is configured. Always scoped to the user's own
 * subject — authorization happens here, not only in the route.
 */
export async function retrieve(opts: {
  userId: string;
  subjectId: string;
  query: string;
  k?: number;
}): Promise<Retrieved[]> {
  const k = opts.k ?? 6;
  const q = opts.query.slice(0, 1000);

  const fts = await db.execute<Omit<Retrieved, "score"> & { rank: number }>(sql`
    select c.id, c.content, c.heading, c.page, c.suspicious, d.filename, d.id as "documentId",
           ts_rank_cd(c.tsv, websearch_to_tsquery('spanish', ${q})) as rank
    from chunks c
    join documents d on d.id = c.document_id
    where c.subject_id = ${opts.subjectId} and d.user_id = ${opts.userId}
      and c.tsv @@ websearch_to_tsquery('spanish', ${q})
    order by rank desc
    limit 20`);

  let ftsRows = fts.rows;
  // websearch_to_tsquery ANDs terms; fall back to OR semantics for natural questions.
  if (ftsRows.length === 0) {
    const orQuery = q
      .toLowerCase()
      .normalize("NFC")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2)
      .slice(0, 12)
      .join(" | ");
    if (orQuery) {
      const r = await db.execute<Omit<Retrieved, "score"> & { rank: number }>(sql`
        select c.id, c.content, c.heading, c.page, c.suspicious, d.filename, d.id as "documentId",
               ts_rank_cd(c.tsv, to_tsquery('spanish', ${orQuery})) as rank
        from chunks c join documents d on d.id = c.document_id
        where c.subject_id = ${opts.subjectId} and d.user_id = ${opts.userId}
          and c.tsv @@ to_tsquery('spanish', ${orQuery})
        order by rank desc limit 20`);
      ftsRows = r.rows;
    }
  }

  let vecRows: (Omit<Retrieved, "score"> & { distance: number })[] = [];
  const em = getEmbeddingModel();
  if (em) {
    try {
      const { embedding } = await embed({
        model: em.model,
        value: q,
        providerOptions: { google: { outputDimensionality: 1536 } },
      });
      const v = `[${embedding.join(",")}]`;
      const r = await db.execute<Omit<Retrieved, "score"> & { distance: number }>(sql`
        select c.id, c.content, c.heading, c.page, c.suspicious, d.filename, d.id as "documentId",
               c.embedding <=> ${v}::vector as distance
        from chunks c join documents d on d.id = c.document_id
        where c.subject_id = ${opts.subjectId} and d.user_id = ${opts.userId} and c.embedding is not null
        order by distance asc limit 20`);
      vecRows = r.rows;
    } catch (e) {
      console.error("[rag] embedding search failed, using FTS only", e);
    }
  }

  return reciprocalRankFusion<Omit<Retrieved, "score">>([ftsRows, vecRows]).slice(0, k);
}
