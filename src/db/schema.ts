import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Auth (Better Auth core schema + role)                               */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("student"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Academic structure                                                  */
/* ------------------------------------------------------------------ */

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    level: text("level"), // ESO, Bachillerato, FP, Universidad, Oposiciones…
    examDate: date("exam_date", { mode: "string" }),
    targetGrade: real("target_grade"),
    minutesPerDay: integer("minutes_per_day").notNull().default(60),
    sourcesOnly: boolean("sources_only").notNull().default(true),
    color: text("color").notNull().default("indigo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subjects_user_idx").on(t.userId)],
);

export const documentStatus = pgEnum("document_status", ["pending", "processing", "ready", "failed"]);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    status: documentStatus("status").notNull().default("pending"),
    pageCount: integer("page_count"),
    charCount: integer("char_count"),
    injectionFlags: integer("injection_flags").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("documents_subject_idx").on(t.subjectId),
    uniqueIndex("documents_subject_hash_uq").on(t.subjectId, t.sha256),
  ],
);

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const EMBEDDING_DIMENSIONS = 1536;

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    page: integer("page"),
    heading: text("heading"),
    content: text("content").notNull(),
    suspicious: boolean("suspicious").notNull().default(false),
    tsv: tsvector("tsv").generatedAlwaysAs(
      sql`to_tsvector('spanish', coalesce(heading, '') || ' ' || content)`,
    ),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  },
  (t) => [
    index("chunks_subject_idx").on(t.subjectId),
    index("chunks_tsv_idx").using("gin", t.tsv),
    index("chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    ordinal: integer("ordinal").notNull().default(0),
    importance: real("importance").notNull().default(1),
    sourceDocumentId: uuid("source_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    sourcePage: integer("source_page"),
  },
  (t) => [
    index("topics_subject_idx").on(t.subjectId),
    uniqueIndex("topics_subject_title_uq").on(t.subjectId, t.normalizedTitle),
  ],
);

/* ------------------------------------------------------------------ */
/* Learning tools                                                      */
/* ------------------------------------------------------------------ */

export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
    sourceChunkId: uuid("source_chunk_id").references(() => chunks.id, { onDelete: "set null" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    origin: text("origin").notNull().default("heuristic"), // heuristic | ai | manual
    // FSRS card state (ts-fsrs)
    due: timestamp("due", { withTimezone: true }).notNull().defaultNow(),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: integer("state").notNull().default(0),
    lastReview: timestamp("last_review", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("flashcards_user_due_idx").on(t.userId, t.due),
    index("flashcards_subject_idx").on(t.subjectId),
    uniqueIndex("flashcards_subject_front_uq").on(t.subjectId, t.front),
  ],
);

export const reviewLogs = pgTable(
  "review_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flashcardId: uuid("flashcard_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // 1 Again, 2 Hard, 3 Good, 4 Easy
    durationMs: integer("duration_ms").notNull().default(0),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("review_logs_user_idx").on(t.userId, t.reviewedAt)],
);

export const questionType = pgEnum("question_type", ["mcq", "true_false"]);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    origin: text("origin").notNull().default("heuristic"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quizzes_subject_idx").on(t.subjectId)],
);

export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  sourceChunkId: uuid("source_chunk_id").references(() => chunks.id, { onDelete: "set null" }),
  ordinal: integer("ordinal").notNull(),
  type: questionType("type").notNull(),
  prompt: text("prompt").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  correct: jsonb("correct").$type<number[]>().notNull(), // indices into options
  explanation: text("explanation").notNull(),
});

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    durationMs: integer("duration_ms").notNull().default(0),
    answers: jsonb("answers")
      .$type<{ questionId: string; selected: number[]; correct: boolean }[]>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quiz_attempts_user_idx").on(t.userId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Adaptive engine                                                     */
/* ------------------------------------------------------------------ */

/** Every observation about what the student knows. Mastery is derived from these. */
export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // flashcard | mcq | true_false | exercise | tutor
    score: real("score").notNull(), // 0..1
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("evidence_user_topic_idx").on(t.userId, t.topicId),
    index("evidence_user_time_idx").on(t.userId, t.createdAt),
  ],
);

export const planItems = pgTable(
  "plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    activity: text("activity").notNull(), // learn | practice | review | mock
    minutes: integer("minutes").notNull(),
    reason: text("reason").notNull(),
    done: boolean("done").notNull().default(false),
  },
  (t) => [index("plan_items_user_day_idx").on(t.userId, t.day)],
);

/* ------------------------------------------------------------------ */
/* Tutor                                                               */
/* ------------------------------------------------------------------ */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    mode: text("mode").notNull().default("explain"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_user_idx").on(t.userId)],
);

export type Citation = { n: number; chunkId: string; filename: string; page: number | null };

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    citations: jsonb("citations").$type<Citation[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Usage accounting (transparent AI consumption; failures not billed)   */
/* ------------------------------------------------------------------ */

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    success: boolean("success").notNull(),
    billable: boolean("billable").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_user_time_idx").on(t.userId, t.createdAt)],
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
