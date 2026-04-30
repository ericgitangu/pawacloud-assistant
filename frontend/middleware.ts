import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route protection — checks for pawacloud_auth cookie set on successful
 * login/signup/OAuth. Unauthenticated visitors land on /login.
 * Chat, status, and other app routes are behind auth to prevent token abuse.
 */

const AUTH_PAGES = ["/login", "/signup"];
const PUBLIC_PATHS = [...AUTH_PAGES, "/auth/callback"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = request.cookies.get("pawacloud_auth");

  // already-authed users hitting /login or /signup get bounced home —
  // honours ?redirect= when present so OAuth round-trips still land correctly
  if (authed && AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    const dest = request.nextUrl.searchParams.get("redirect") ?? "/";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // always allow public pages and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/health") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/manifest.json" ||
    pathname === "/og-image.png"
  ) {
    return NextResponse.next();
  }

  // only authenticated users (login, signup, or OAuth) get through
  if (authed) {
    return NextResponse.next();
  }

  // OAuth redirect carries auth param — let through for token exchange
  const authParam = request.nextUrl.searchParams.get("auth");
  if (authParam === "token" || authParam === "success") {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("redirect", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|icons/.*|og-image.png).*)",
  ],
};
