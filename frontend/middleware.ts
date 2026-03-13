import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route protection — checks for pawacloud_auth cookie set on successful
 * login/signup/guest-pass. Unauthenticated visitors land on /login.
 * Chat, status, and other app routes are behind auth to prevent token abuse.
 */

const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // only authenticated users (login, signup, guest-pass, or OAuth) get through
  const authed = request.cookies.get("pawacloud_auth");
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
