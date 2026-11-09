import "server-only";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import type { EmailContent } from "./templates";

/**
 * Email delivery.
 *   EMAIL_PROVIDER=resend  → Resend HTTP API (needs RESEND_API_KEY and EMAIL_FROM)
 *   EMAIL_PROVIDER=outbox  → stored in email_log (development / tests); never in production,
 *                            except the E2E test server, which sets ALLOW_TEST_OUTBOX=1 explicitly
 *   unset                  → resend if RESEND_API_KEY exists, else outbox outside production
 * In production with no provider, emails are logged as failed and an admin
 * warning is shown — they are never silently dropped.
 */
export type EmailKind = "reset_password" | "verify_email" | "password_changed";

export function emailProvider(): "resend" | "outbox" | "none" {
  const p = process.env.EMAIL_PROVIDER;
  if (p === "resend") return "resend";
  if (p === "outbox") return process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_OUTBOX !== "1" ? "none" : "outbox";
  if (process.env.RESEND_API_KEY) return "resend";
  return process.env.NODE_ENV === "production" ? "none" : "outbox";
}

type Fetch = typeof fetch;

export async function sendWithResend(
  msg: { to: string; from: string } & EmailContent,
  apiKey: string,
  fetchImpl: Fetch = fetch,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: msg.from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) return { ok: false, error: `${res.status} ${data.name ?? ""} ${data.message ?? ""}`.trim().slice(0, 300) };
    return { ok: true, id: data.id ?? "" };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 300) };
  }
}

/**
 * Builds and sends an email; template errors (e.g. a misconfigured base URL
 * producing an invalid link) are logged as failures instead of vanishing.
 */
export async function deliver(kind: EmailKind, to: string, build: () => EmailContent) {
  let content: EmailContent;
  try {
    content = build();
  } catch (e) {
    const error = `No se pudo generar el correo: ${(e as Error).message}`.slice(0, 300);
    console.error(`[email] ${kind} to ${to}: ${error}`);
    await db.insert(emailLog).values({ to, kind, provider: emailProvider(), status: "failed", error, subject: "(sin generar)" }).catch(() => {});
    return { status: "failed" as const, error };
  }
  return sendEmail(kind, to, content);
}

/** Sends (or stores) an email and logs the outcome. Never throws. */
export async function sendEmail(kind: EmailKind, to: string, content: EmailContent, fetchImpl: Fetch = fetch) {
  const provider = emailProvider();
  let status: "sent" | "stored" | "failed" = "failed";
  let providerId: string | null = null;
  let error: string | null = null;

  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) error = "Falta RESEND_API_KEY o EMAIL_FROM";
    else {
      const r = await sendWithResend({ to, from, ...content }, key, fetchImpl);
      if (r.ok) {
        status = "sent";
        providerId = r.id;
      } else error = r.error;
    }
  } else if (provider === "outbox") {
    status = "stored";
  } else {
    error = "No hay proveedor de email configurado";
  }

  if (status === "failed") console.error(`[email] ${kind} to ${to} failed: ${error}`);
  try {
    await db.insert(emailLog).values({
      to,
      kind,
      provider,
      status,
      providerId,
      error,
      subject: content.subject,
      body: provider === "outbox" ? content.text : null,
    });
  } catch (e) {
    console.error("[email] could not log email", e);
  }
  return { status, error };
}
