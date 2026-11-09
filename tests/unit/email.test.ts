import { afterEach, describe, expect, it, vi } from "vitest";
import { emailProvider, sendWithResend } from "@/lib/email/send";
import { escapeHtml, passwordChangedEmail, resetPasswordEmail, verifyEmailEmail } from "@/lib/email/templates";

describe("email templates", () => {
  it("escapes user-provided names (no HTML injection in emails)", () => {
    const e = resetPasswordEmail({ name: '<img src=x onerror=alert(1)> Ana', url: "https://triff.app/api/auth/reset-password/abc?callbackURL=%2Freset-password", minutes: 30 });
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).toContain("&lt;img");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });
  it("includes the link and expiry in HTML and text versions", () => {
    const url = "https://triff.app/api/auth/reset-password/tok123?callbackURL=%2Freset-password";
    const e = resetPasswordEmail({ name: "Ana López", url, minutes: 30 });
    expect(e.subject).toMatch(/contraseña/);
    expect(e.text).toContain(url);
    expect(e.text).toContain("30 minutos");
    expect(e.html).toContain("Hola, Ana:");
    expect(verifyEmailEmail({ name: "Ana", url: "https://triff.app/verify?t=1" }).text).toContain("https://triff.app/verify?t=1");
    expect(passwordChangedEmail({ name: "Ana", when: new Date("2026-11-09T10:00:00Z"), supportUrl: "https://triff.app/forgot-password" }).text).toMatch(/9 de noviembre de 2026/);
  });
  it("refuses non-http links", () => {
    expect(() => verifyEmailEmail({ name: "A", url: "javascript:alert(1)" })).toThrow();
  });
});

describe("Resend client", () => {
  const msg = { to: "a@example.com", from: "Triff <hola@triff.app>", subject: "S", html: "<p>h</p>", text: "t" };
  it("posts the message with the API key and returns the id", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "em_123" }), { status: 200 }));
    const r = await sendWithResend(msg, "re_test", fetchMock as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, id: "em_123" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ["a@example.com"], subject: "S", text: "t" });
  });
  it("reports API and network errors without throwing", async () => {
    const bad = vi.fn(async () => new Response(JSON.stringify({ name: "validation_error", message: "Invalid from" }), { status: 422 }));
    expect(await sendWithResend(msg, "k", bad as unknown as typeof fetch)).toEqual({ ok: false, error: "422 validation_error Invalid from" });
    const down = vi.fn(async () => { throw new Error("ECONNRESET"); });
    expect(await sendWithResend(msg, "k", down as unknown as typeof fetch)).toEqual({ ok: false, error: "ECONNRESET" });
  });
});

describe("provider selection", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("uses the local outbox without a key outside production, and never in production", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_PROVIDER", "");
    expect(emailProvider()).toBe("outbox");
    vi.stubEnv("NODE_ENV", "production");
    expect(emailProvider()).toBe("none");
    vi.stubEnv("EMAIL_PROVIDER", "outbox");
    expect(emailProvider()).toBe("none");
    vi.stubEnv("RESEND_API_KEY", "re_x");
    vi.stubEnv("EMAIL_PROVIDER", "");
    expect(emailProvider()).toBe("resend");
  });
});
