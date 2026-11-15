import "server-only";

import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "marina_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionRole = "admin" | "owner";

export type SessionPayload = {
  userId: number;
  role: SessionRole;
  username: string;
};

// Ephemeral fallback for local dev — regenerating per boot invalidates old
// sessions, which is fine locally. Production MUST set SESSION_SECRET.
const devSecret = randomBytes(48);

function signingKey(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (raw && raw.trim().length > 0) {
    return new TextEncoder().encode(raw);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is required in production. Generate one with: openssl rand -base64 48",
    );
  }
  return devSecret;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, role: payload.role, username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.userId))
    .setIssuedAt()
    // jose interprets a numeric exp as an absolute Unix timestamp (seconds),
    // so compute "now + TTL" explicitly.
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(signingKey());
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });

    const { userId, role, username } = payload;
    if (typeof userId !== "number" || Number.isNaN(userId)) return null;
    if (role !== "admin" && role !== "owner") return null;

    return {
      userId,
      role,
      username: typeof username === "string" ? username : "",
    };
  } catch {
    return null;
  }
}
