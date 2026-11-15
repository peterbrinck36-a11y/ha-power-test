import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

const PUBLIC_ROUTES = ["/login"];

/**
 * Next.js 16 proxy (replacement for middleware.ts).
 * Optimistic JWT-only checks — no DB access here. Real authorization happens
 * in pages/actions via requireUser/requireAdmin, which also catch disabled
 * users that the stateless token can't see.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  const isProtected =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  if (isPublic && session) {
    const target = session.role === "admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(target, request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|webmanifest)$).*)",
  ],
};
