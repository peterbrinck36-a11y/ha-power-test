"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { compareSync } from "bcryptjs";

import { db } from "@/lib/db";
import { users, type User } from "@/lib/schema";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth";

export type LoginState = { error: string | null };

// Simple in-memory brute-force guard, keyed by client IP.
// MAX_LOGIN_ATTEMPTS is overridable for E2E runs (many logins share one IP).
const MAX_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS ?? 10);
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

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
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
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

  const passwordOk = user ? compareSync(password, user.passwordHash) : false;
  if (!user || !passwordOk) {
    return { error: "Invalid email/username or password." };
  }
  if (!user.active) {
    return { error: "This account is disabled. Contact the marina admin." };
  }

  attempts.delete(ip);
  await setSessionCookie({ userId: user.id, role: user.role, username: user.username });
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
