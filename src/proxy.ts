import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic redirect only (cookie presence). Real authorization happens in the
 * Data Access Layer (requireUser / per-query userId scoping) on every request.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/subjects/:path*", "/tutor/:path*", "/review/:path*", "/quiz/:path*", "/logros/:path*"],
};
