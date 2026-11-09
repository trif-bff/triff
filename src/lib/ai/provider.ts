import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel } from "ai";

/**
 * Provider registry. Everything is driven by environment variables so models
 * and providers can be changed without code changes (admin panel will write
 * the same settings to the DB in a later phase).
 *
 *   AI_PROVIDER=anthropic|openai|google   (default anthropic)
 *   AI_MODEL_TUTOR, AI_MODEL_GENERATION    (default claude-opus-5-5)
 *   EMBEDDINGS_PROVIDER=openai|google|none (default none → full-text search only)
 */

export type Feature = "tutor" | "generation";

export type AiOverrides = { provider?: "anthropic" | "openai" | "google" | null; models?: { tutor?: string | null; generation?: string | null } };

export const PROVIDER_KEY_VARS = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", google: "GOOGLE_GENERATIVE_AI_API_KEY" } as const;

/** Which providers have a key configured (booleans only — never the values). */
export function providerStatus() {
  return Object.fromEntries(Object.entries(PROVIDER_KEY_VARS).map(([p, v]) => [p, Boolean(process.env[v])])) as Record<keyof typeof PROVIDER_KEY_VARS, boolean>;
}

export function aiConfig(overrides: AiOverrides = {}) {
  const provider = (overrides.provider ?? process.env.AI_PROVIDER ?? "anthropic") as "anthropic" | "openai" | "google";
  const keyVar = PROVIDER_KEY_VARS[provider];
  const enabled = Boolean(process.env[keyVar]);
  const defaults = {
    anthropic: { tutor: "claude-opus-5-5", generation: "claude-opus-5-5" },
    openai: { tutor: "gpt-5", generation: "gpt-5-mini" },
    google: { tutor: "gemini-2.5-pro", generation: "gemini-2.5-flash" },
  }[provider];
  return {
    provider,
    enabled,
    models: {
      tutor: overrides.models?.tutor || process.env.AI_MODEL_TUTOR || defaults.tutor,
      generation: overrides.models?.generation || process.env.AI_MODEL_GENERATION || defaults.generation,
    },
  };
}

export function isAiEnabled(overrides: AiOverrides = {}) {
  return aiConfig(overrides).enabled;
}

export function getModel(feature: Feature, overrides: AiOverrides = {}): { model: LanguageModel; provider: string; modelId: string } {
  const cfg = aiConfig(overrides);
  if (!cfg.enabled) throw new Error("AI_DISABLED");
  const modelId = cfg.models[feature];
  switch (cfg.provider) {
    case "openai":
      return { model: createOpenAI()(modelId), provider: "openai", modelId };
    case "google":
      return { model: createGoogleGenerativeAI()(modelId), provider: "google", modelId };
    default:
      return { model: createAnthropic()(modelId), provider: "anthropic", modelId };
  }
}

export function getEmbeddingModel(): { model: EmbeddingModel; modelId: string } | null {
  const p = process.env.EMBEDDINGS_PROVIDER ?? "none";
  if (p === "openai" && process.env.OPENAI_API_KEY) {
    const modelId = process.env.EMBEDDINGS_MODEL ?? "text-embedding-3-small"; // 1536 dims
    return { model: createOpenAI().textEmbeddingModel(modelId), modelId };
  }
  if (p === "google" && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const modelId = process.env.EMBEDDINGS_MODEL ?? "gemini-embedding-001";
    return { model: createGoogleGenerativeAI().textEmbeddingModel(modelId), modelId };
  }
  return null;
}
