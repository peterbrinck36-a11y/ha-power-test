import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "./db";
import { users, type User } from "./schema";
import { sessionCookieOptions } from "./cookie";
import {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

export type { SessionPayload };

/**
 * Full session check for pages/route handlers/actions:
 * verifies the JWT *and* re-reads the user from SQLite so disabled or deleted
 * users are cut off immediately (proxy.ts only does the optimistic JWT check).
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const rows = db.select().from(users).where(eq(users.id, session.userId)).limit(1).all();
  const user = rows[0];
  if (!user || !user.active) return null;

  // A password change/reset bumps session_version — older cookies stop working.
  if ((session.sv ?? 0) !== user.sessionVersion) return null;

  return user;
});

/** Sets the signed HTTP-only session cookie. Call from server actions / route handlers. */
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, await sessionCookieOptions());
}

/** Clears the session cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** Page/route/action guard: any signed-in, active user. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Temporary-password accounts cannot reach the app until they choose one.
  if (user.mustChangePassword) redirect("/account/password");
  return user;
}

/** Page/route/action guard: admin only; owners get bounced to the dashboard. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
