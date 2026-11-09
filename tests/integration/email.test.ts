import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db";
import { emailLog, session, user } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { deliver, sendEmail } from "@/lib/email/send";

const tag = randomUUID().slice(0, 8);
const email = `mail-${tag}@example.com`;
const ghost = `nadie-${tag}@example.com`;
const password = "contraseña-segura-123";
const newPassword = "otra-contraseña-segura-456";
const created: string[] = [];

/** Emails are sent without awaiting (timing-attack protection): wait for the log row. */
async function waitForEmail(to: string, kind: string, after = new Date(0)) {
  for (let i = 0; i < 50; i++) {
    const [row] = await db.select().from(emailLog).where(and(eq(emailLog.to, to), eq(emailLog.kind, kind))).orderBy(desc(emailLog.createdAt)).limit(1);
    if (row && row.createdAt >= after) return row;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`no ${kind} email for ${to}`);
}

afterAll(async () => {
  await db.delete(user).where(inArray(user.id, created));
  await db.delete(emailLog).where(inArray(emailLog.to, [email, ghost]));
  vi.unstubAllEnvs();
  await pool.end();
});

describe("email flows (local outbox)", () => {
  it("sends a verification email on sign-up and verifies the address", async () => {
    const r = await auth.api.signUpEmail({ body: { name: "Mar", email, password, callbackURL: "/dashboard?verified=1" } });
    created.push(r.user.id);
    expect(r.user.emailVerified).toBe(false);
    const mail = await waitForEmail(email, "verify_email");
    expect(mail.status).toBe("stored");
    const token = new URL(mail.body!.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;
    await auth.api.verifyEmail({ query: { token } });
    const [u] = await db.select().from(user).where(eq(user.id, r.user.id));
    expect(u.emailVerified).toBe(true);
  });

  it("does not reveal whether an account exists", async () => {
    const a = await auth.api.requestPasswordReset({ body: { email: ghost, redirectTo: "/reset-password" } });
    const b = await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
    expect(a).toEqual(b);
    await waitForEmail(email, "reset_password");
    await new Promise((r) => setTimeout(r, 200));
    expect(await db.select().from(emailLog).where(eq(emailLog.to, ghost))).toHaveLength(0);
  });

  it("resets the password with a single-use link, revokes sessions and notifies", async () => {
    await auth.api.signInEmail({ body: { email, password } });
    const [u] = await db.select().from(user).where(eq(user.email, email));
    expect((await db.select().from(session).where(eq(session.userId, u.id))).length).toBeGreaterThan(0);

    const since = new Date();
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
    const mail = await waitForEmail(email, "reset_password", since);
    expect(mail.body).toMatch(/30 minutos/);
    const token = mail.body!.match(/reset-password\/([A-Za-z0-9_-]+)/)![1];

    await auth.api.resetPassword({ body: { newPassword, token } });
    expect(await db.select().from(session).where(eq(session.userId, u.id))).toHaveLength(0);
    expect((await waitForEmail(email, "password_changed", since)).subject).toMatch(/ha cambiado/);

    await expect(auth.api.signInEmail({ body: { email, password } })).rejects.toThrow();
    await expect(auth.api.signInEmail({ body: { email, password: newPassword } })).resolves.toBeTruthy();
    await expect(auth.api.resetPassword({ body: { newPassword: "tercera-contraseña-789", token } })).rejects.toThrow(); // single use
  });

  it("logs failures instead of throwing when the provider is misconfigured", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    const r = await sendEmail("verify_email", email, { subject: "x", html: "<p>x</p>", text: "x" });
    expect(r.status).toBe("failed");
    const [row] = await db.select().from(emailLog).where(and(eq(emailLog.to, email), eq(emailLog.status, "failed")));
    expect(row.error).toMatch(/RESEND_API_KEY/);
    expect(row.body).toBeNull(); // no content stored outside the local outbox
    vi.unstubAllEnvs();
    // A broken link (e.g. base URL not configured) is logged, not silently lost.
    const broken = await deliver("reset_password", email, () => { throw new Error("Invalid URL"); });
    expect(broken.status).toBe("failed");
    const rows = await db.select().from(emailLog).where(and(eq(emailLog.to, email), eq(emailLog.subject, "(sin generar)")));
    expect(rows[0].error).toMatch(/Invalid URL/);
  });
});
