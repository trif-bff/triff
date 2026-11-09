import "server-only";
import { NextResponse } from "next/server";
import { getUser, type SessionUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/services/usage";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Common guard for mutating route handlers:
 *  - same-origin check (CSRF defence in addition to SameSite=Lax cookies)
 *  - authenticated session
 *  - per-user rate limit
 */
export async function guard(req: Request, opts: { limit?: number } = {}): Promise<SessionUser | NextResponse> {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (req.method !== "GET" && origin && host && new URL(origin).host !== host) {
    return jsonError("Origen no permitido", 403);
  }
  const user = await getUser();
  if (!user) return jsonError("No autenticado", 401);
  if (!rateLimit(`${user.id}:${new URL(req.url).pathname}`, opts.limit ?? 30)) {
    return jsonError("Demasiadas peticiones. Espera un momento.", 429);
  }
  return user;
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}
