import { describe, expect, it } from "vitest";
import { estimateCost } from "@/lib/admin/costs";
import { can, checkUserChange, isStaff } from "@/lib/admin/permissions";
import { DEFAULT_SETTINGS, resolveSettings, settingsSchema } from "@/lib/admin/settings-schema";

describe("RBAC", () => {
  it("grants support read-only access and admins everything", () => {
    expect(can("student", "admin.view")).toBe(false);
    expect(can("support", "users.view")).toBe(true);
    expect(can("support", "users.manage")).toBe(false);
    expect(can("support", "settings.manage")).toBe(false);
    expect(can("admin", "settings.manage")).toBe(true);
    expect(can("hacker", "admin.view")).toBe(false);
    expect(isStaff("support")).toBe(true);
    expect(isStaff("student")).toBe(false);
  });

  const admin = { id: "a", role: "admin" };
  it("blocks self-demotion, self-suspension and losing the last admin", () => {
    expect(checkUserChange({ actor: admin, target: admin, change: { role: "student" }, adminCount: 2 })).toMatch(/propio rol/);
    expect(checkUserChange({ actor: admin, target: admin, change: { banned: true }, adminCount: 2 })).toMatch(/propio rol/);
    expect(checkUserChange({ actor: admin, target: { id: "b", role: "admin" }, change: { role: "support" }, adminCount: 1 })).toMatch(/al menos un administrador/);
    expect(checkUserChange({ actor: admin, target: { id: "b", role: "admin" }, change: { role: "support" }, adminCount: 2 })).toBeNull();
    expect(checkUserChange({ actor: { id: "s", role: "support" }, target: { id: "b", role: "student" }, change: { banned: true }, adminCount: 1 })).toMatch(/permiso/);
    expect(checkUserChange({ actor: admin, target: { id: "b", role: "student" }, change: { banned: false }, adminCount: 1 })).toBeNull();
  });
});

describe("settings", () => {
  it("falls back to defaults and honours the env free limit", () => {
    expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings(undefined, { freeLimit: "10" }).plans.free.aiDailyLimit).toBe(10);
  });
  it("merges partial stored values over defaults", () => {
    const s = resolveSettings({ plans: { premium: { aiDailyLimit: 1000 } }, prices: { "my-model": { input: 1, output: 2 } } });
    expect(s.plans.free.aiDailyLimit).toBe(40);
    expect(s.plans.premium.aiDailyLimit).toBe(1000);
    expect(s.prices["my-model"]).toEqual({ input: 1, output: 2 });
    expect(s.prices["claude-opus-5-5"]).toBeDefined();
  });
  it("ignores invalid stored values instead of breaking the app", () => {
    expect(resolveSettings({ plans: { free: { aiDailyLimit: -5 } } })).toEqual(DEFAULT_SETTINGS);
  });
  it("rejects model ids with unexpected characters", () => {
    const bad = structuredClone(DEFAULT_SETTINGS);
    bad.ai.models.tutor = "claude; rm -rf /";
    expect(settingsSchema.safeParse(bad).success).toBe(false);
  });
});

describe("cost estimation", () => {
  it("prices known models and reports unknown ones", () => {
    const r = estimateCost(
      [
        { model: "claude-opus-5-5", inputTokens: 6000, outputTokens: 800 },
        { model: "mystery", inputTokens: 100, outputTokens: 100 },
        { model: "mystery-failed", inputTokens: 0, outputTokens: 0 },
      ],
      DEFAULT_SETTINGS.prices,
    );
    expect(r.total).toBeCloseTo(0.04, 4);
    expect(r.unpriced).toEqual(["mystery"]);
  });
});
