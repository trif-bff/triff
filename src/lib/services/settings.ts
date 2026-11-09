import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, auditLog } from "@/db/schema";
import { can } from "@/lib/admin/permissions";
import { resolveSettings, settingsSchema, type Settings } from "@/lib/admin/settings-schema";

const KEY = "config";
const TTL_MS = 30_000;
let cache: { at: number; value: Settings } | null = null;

/** Current settings (DB over defaults), cached briefly per process. */
export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, KEY));
  const value = resolveSettings(row?.value, { freeLimit: process.env.AI_DAILY_LIMIT_FREE });
  cache = { at: Date.now(), value };
  return value;
}

export function invalidateSettingsCache() {
  cache = null;
}

/** Validates, stores and audits a full settings document (requires settings.manage). */
export async function saveSettings(actor: { id: string; role: string }, next: unknown) {
  if (!can(actor.role, "settings.manage")) return { error: "Solo un administrador puede cambiar la configuración." } as const;
  const actorId = actor.id;
  const parsed = settingsSchema.safeParse(next);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Configuración no válida" } as const;
  const before = await getSettings();
  await db
    .insert(appSettings)
    .values({ key: KEY, value: parsed.data, updatedBy: actorId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: parsed.data, updatedBy: actorId, updatedAt: new Date() } });
  await db.insert(auditLog).values({ userId: actorId, action: "settings.updated", target: KEY, meta: { before, after: parsed.data } });
  invalidateSettingsCache();
  return { settings: parsed.data } as const;
}
