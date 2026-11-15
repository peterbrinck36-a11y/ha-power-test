import "server-only";

import { headers } from "next/headers";

import { SESSION_TTL_SECONDS } from "./session-token";

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

/**
 * Resolves the cookie Secure flag from COOKIE_SECURE:
 * - "true"  → always secure
 * - "false" → never secure
 * - "auto" (default) → secure only when x-forwarded-proto is https, so local
 *   HTTP testing (http://localhost:3000) and HTTPS reverse-proxy deployments
 *   both work cleanly.
 */
export async function sessionCookieOptions(): Promise<SessionCookieOptions> {
  const mode = (process.env.COOKIE_SECURE ?? "auto").trim().toLowerCase();

  let secure: boolean;
  if (mode === "true") {
    secure = true;
  } else if (mode === "false") {
    secure = false;
  } else {
    const headerList = await headers();
    const forwardedProto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
    secure = forwardedProto === "https";
  }

  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
