import { z } from "zod";

/**
 * Runtime settings editable from the admin panel. Secrets (API keys) are NEVER
 * stored here: they live only in environment variables.
 */
const price = z.object({ input: z.number().min(0).max(1000), output: z.number().min(0).max(1000) }); // USD per million tokens

export const settingsSchema = z.object({
  plans: z.object({
    free: z.object({ aiDailyLimit: z.number().int().min(0).max(100_000) }),
    premium: z.object({ aiDailyLimit: z.number().int().min(0).max(100_000) }),
  }),
  ai: z.object({
    provider: z.enum(["anthropic", "openai", "google"]).nullable(), // null = use AI_PROVIDER env
    models: z.object({
      tutor: z.string().trim().max(100).regex(/^[a-z0-9.\-:]*$/i, "Identificador de modelo no válido").nullable(),
      generation: z.string().trim().max(100).regex(/^[a-z0-9.\-:]*$/i, "Identificador de modelo no válido").nullable(),
    }),
  }),
  /** List prices to estimate cost; verify against the provider before relying on them. */
  prices: z.record(z.string().max(100), price),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  plans: { free: { aiDailyLimit: 40 }, premium: { aiDailyLimit: 400 } },
  ai: { provider: null, models: { tutor: null, generation: null } },
  prices: {
    // Anthropic list prices (USD / MTok) as of 2026-10; verify before billing decisions.
    "claude-opus-5-5": { input: 4, output: 20 },
    "claude-sonnet-5-5": { input: 2, output: 10 },
    "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  },
};

/** Deep-merges a stored (possibly partial or older) value over the defaults, then validates. */
export function resolveSettings(stored: unknown, env: { freeLimit?: string } = {}): Settings {
  const base: Settings = structuredClone(DEFAULT_SETTINGS);
  if (env.freeLimit && Number.isFinite(Number(env.freeLimit))) base.plans.free.aiDailyLimit = Number(env.freeLimit);
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Partial<Settings>;
  const merged = {
    plans: { free: { ...base.plans.free, ...s.plans?.free }, premium: { ...base.plans.premium, ...s.plans?.premium } },
    ai: { provider: s.ai?.provider ?? base.ai.provider, models: { ...base.ai.models, ...s.ai?.models } },
    prices: { ...base.prices, ...s.prices },
  };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : base;
}
