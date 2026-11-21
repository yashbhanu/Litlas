import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/db/proxy";

/** Routes that need a signed-in user. Pages re-check on the server; this is the fast path. */
const PROTECTED_PREFIXES = ["/me", "/add", "/onboarding", "/settings"];

/** /book/<id> and /place/<id> take a UUID; anything else is a 404 before rendering. */
const ID_ROUTE = /^\/(book|place)\/([^/]+)\/?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function proxy(request: NextRequest) {
  const idMatch = ID_ROUTE.exec(request.nextUrl.pathname);
  if (idMatch && !UUID.test(idMatch[2]!)) {
    // With Cache Components a page can't change its status once streaming starts, so
    // malformed ids get their 404 here. (Unknown but valid ids render not-found + noindex.)
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !userId) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(loginUrl);
    // Keep any refreshed/cleared auth cookies.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  // Skip static assets and images; API routes are included so their sessions refresh too.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|geo/|maplibre/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
