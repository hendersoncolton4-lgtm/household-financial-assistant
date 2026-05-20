import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/login", "/manifest.webmanifest"];
const PUBLIC_PREFIXES = ["/_next", "/favicon"];

/**
 * Gate every route behind the household password. The login page + login
 * API + Next's static assets are the only public paths.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await verifySessionCookie(cookie);
  if (valid) return NextResponse.next();

  // API requests get JSON 401 rather than redirected (avoids HTML being
  // returned to fetch() callers).
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  if (pathname !== "/" && pathname !== "/login") {
    loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except Next's internal asset routes. The middleware
  // itself short-circuits public paths.
  matcher: "/((?!_next/static|_next/image).*)",
};
