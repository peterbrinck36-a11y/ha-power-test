"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { compare, hashSync } from "bcryptjs";

import { db } from "@/lib/db";
import { users, type User } from "@/lib/schema";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth";

export type LoginState = { error: string | null };

// Simple in-memory brute-force guard, keyed by client IP.
// MAX_LOGIN_ATTEMPTS is overridable for E2E runs (many logins share one IP).
const MAX_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS ?? 10);
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

// Number of reverse proxies in front of the app that APPEND to X-Forwarded-For
// (Nginx Proxy Manager, Traefik, Caddy, … = 1). The client IP is taken that many
// entries from the RIGHT, because everything further left is client-supplied
// and can be forged to dodge the rate limit. 0 = ignore the header entirely
// (direct exposure without a proxy — all clients then share one bucket).
const TRUSTED_PROXY_HOPS = Math.max(0, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS ?? 1)) || 0);

function clientKey(forwardedFor: string | null): string {
  if (TRUSTED_PROXY_HOPS === 0 || !forwardedFor) return "local";
  const hops = forwardedFor
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (hops.length === 0) return "local";
  // Fewer entries than trusted proxies → use the left-most (best available).
  return hops[Math.max(0, hops.length - TRUSTED_PROXY_HOPS)];
}

// Compared against when the account doesn't exist, so a wrong username takes
// as long as a wrong password (no account enumeration via response time).
const DUMMY_HASH = hashSync("not-a-real-password", 12);

function consumeRateLimit(key: string): { ok: boolean; minutesLeft: number } {
  const now = Date.now();

  if (attempts.size > 1000) {
    for (const [k, v] of attempts) {
      if (v.resetAt <= now) attempts.delete(k);
    }
  }

  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, minutesLeft: 0 };
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return {
      ok: false,
      minutesLeft: Math.max(1, Math.ceil((entry.resetAt - now) / 60_000)),
    };
  }
  return { ok: true, minutesLeft: 0 };
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { error: "Enter your email or username and your password." };
  }

  const headerList = await headers();
  const ip = clientKey(headerList.get("x-forwarded-for"));
  const limit = consumeRateLimit(ip);
  if (!limit.ok) {
    return {
      error: `Too many sign-in attempts. Try again in ${limit.minutesLeft} minute(s).`,
    };
  }

  // Single login field: matches email OR username, case-insensitively.
  const ident = identifier.toLowerCase();
  const rows = db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${ident} or lower(${users.username}) = ${ident}`)
    .limit(1)
    .all();
  const user: User | undefined = rows[0];

  // Async compare keeps the event loop free; always run it (see DUMMY_HASH).
  const passwordOk = await compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    return { error: "Invalid email/username or password." };
  }
  if (!user.active) {
    return { error: "This account is disabled. Contact the marina admin." };
  }

  if (
    user.mustChangePassword &&
    user.tempPasswordExpiresAt &&
    user.tempPasswordExpiresAt.getTime() < Date.now()
  ) {
    return {
      error: "This temporary password has expired. Contact the marina admin for a new one.",
    };
  }

  attempts.delete(ip);
  await setSessionCookie({
    userId: user.id,
    role: user.role,
    username: user.username,
    sv: user.sessionVersion,
  });
  redirect(
    user.mustChangePassword
      ? "/account/password"
      : user.role === "admin"
        ? "/admin"
        : "/dashboard",
  );
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
