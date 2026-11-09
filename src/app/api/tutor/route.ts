import { streamText, type ModelMessage } from "ai";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversations, messages, type Citation } from "@/db/schema";
import { getModel, isAiEnabled } from "@/lib/ai/provider";
import { buildSystemPrompt, formatSources, TUTOR_MODES } from "@/lib/ai/prompts";
import { guard, isResponse, jsonError } from "@/lib/http";
import { retrieve, type Retrieved } from "@/lib/rag/retrieve";
import { getOwnedSubject } from "@/lib/services/documents";
import { getSettings } from "@/lib/services/settings";
import { assertQuota, logUsage } from "@/lib/services/usage";

export const maxDuration = 120;

const IMAGE_RE = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

const body = z.object({
  conversationId: z.uuid().nullish(),
  subjectId: z.uuid().nullish(),
  mode: z.enum(TUTOR_MODES).default("explain"),
  style: z.string().max(40).nullish(),
  message: z.string().trim().min(1).max(6000),
  image: z.string().max(6_000_000).regex(IMAGE_RE).nullish(),
});

export async function POST(req: Request) {
  const user = await guard(req, { limit: 20 });
  if (isResponse(user)) return user;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Mensaje no válido");
  const input = parsed.data;

  const subject = input.subjectId ? await getOwnedSubject(user.id, input.subjectId) : null;
  if (input.subjectId && !subject) return jsonError("Asignatura no encontrada", 404);

  // Conversation (owned by the user)
  let conversationId = input.conversationId ?? null;
  if (conversationId) {
    const [c] = await db.select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)));
    if (!c) return jsonError("Conversación no encontrada", 404);
  } else {
    const [c] = await db
      .insert(conversations)
      .values({ userId: user.id, subjectId: subject?.id ?? null, title: input.message.slice(0, 80), mode: input.mode })
      .returning();
    conversationId = c.id;
  }

  const history = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(12);
  history.reverse();

  const sources: Retrieved[] = subject ? await retrieve({ userId: user.id, subjectId: subject.id, query: input.message, k: 6 }) : [];
  const citations: Citation[] = sources.map((s, i) => ({ n: i + 1, chunkId: s.id, filename: s.filename, page: s.page }));
  await db.insert(messages).values({ conversationId, role: "user", content: input.message });

  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Conversation-Id": conversationId,
    "X-Citations": Buffer.from(JSON.stringify(citations)).toString("base64"),
    "Cache-Control": "no-store",
  };

  const aiOverrides = (await getSettings()).ai;
  if (!isAiEnabled(aiOverrides)) {
    const text = offlineAnswer(sources, Boolean(subject));
    await db.insert(messages).values({ conversationId, role: "assistant", content: text, citations });
    return new Response(text, { headers });
  }

  try {
    await assertQuota(user);
  } catch (e) {
    return jsonError((e as Error).message, 429);
  }

  const { model, provider, modelId } = getModel("tutor", aiOverrides);
  const system = buildSystemPrompt({ mode: input.mode, level: subject?.level, subject: subject?.name, sourcesOnly: subject?.sourcesOnly ?? false, style: input.style });
  const img = input.image?.match(IMAGE_RE);
  const userContent: ModelMessage["content"] = [
    { type: "text", text: `${formatSources(sources.map((s, i) => ({ n: i + 1, ...s })))}\n\nPregunta del estudiante:\n${input.message}` },
    ...(img ? [{ type: "image" as const, image: img[2], mediaType: img[1] }] : []),
  ];

  const result = streamText({
    model,
    system,
    messages: [
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: userContent } as ModelMessage,
    ],
    maxOutputTokens: 4000,
    onFinish: async ({ text, totalUsage }) => {
      await db.insert(messages).values({ conversationId: conversationId!, role: "assistant", content: text, citations });
      await logUsage({ userId: user.id, feature: `tutor:${input.mode}`, provider, model: modelId, inputTokens: totalUsage.inputTokens ?? 0, outputTokens: totalUsage.outputTokens ?? 0, success: true });
    },
    onError: async ({ error }) => {
      console.error("[tutor]", error);
      await logUsage({ userId: user.id, feature: `tutor:${input.mode}`, provider, model: modelId, success: false });
    },
  });
  return result.toTextStreamResponse({ headers });
}

export async function GET(req: Request) {
  const user = await guard(req, { limit: 60 });
  if (isResponse(user)) return user;
  const id = new URL(req.url).searchParams.get("conversationId");
  if (!id || !z.uuid().safeParse(id).success) return jsonError("Falta conversationId");
  const [c] = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, user.id)));
  if (!c) return jsonError("Conversación no encontrada", 404);
  const rows = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
  return Response.json({ conversation: c, messages: rows });
}

/** Without an AI provider the tutor is honest: it shows the most relevant passages of the notes. */
function offlineAnswer(sources: Retrieved[], hasSubject: boolean) {
  const head =
    "**El tutor de IA no está configurado** en este entorno (falta la clave del proveedor). Mientras tanto, te muestro lo más relevante de tus apuntes:\n\n";
  if (!hasSubject) return head.replace("Mientras tanto, te muestro lo más relevante de tus apuntes:", "Selecciona una asignatura para buscar en tus apuntes.");
  if (sources.length === 0) return head + "_No he encontrado fragmentos relacionados. Prueba con otras palabras o sube el material del tema._";
  return (
    head +
    sources
      .slice(0, 3)
      .map((s, i) => `> ${s.content.slice(0, 600).replace(/\n+/g, " ")}${s.content.length > 600 ? "…" : ""} [${i + 1}]`)
      .join("\n\n")
  );
}
