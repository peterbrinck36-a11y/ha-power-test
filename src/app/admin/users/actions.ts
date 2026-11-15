"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { hashSync } from "bcryptjs";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import { users } from "@/lib/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,39}$/;
const MIN_PASSWORD_LENGTH = 8;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function validateIdentity(email: string, username: string): string | null {
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  if (!USERNAME_RE.test(username)) {
    return "Username must be 2–40 characters: letters, numbers, dots, dashes or underscores.";
  }
  return null;
}

/** True when `userId` is the only remaining active admin. */
function isLastActiveAdmin(userId: number): boolean {
  const rows = db
    .select({ n: count() })
    .from(users)
    .where(
      and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, userId)),
    )
    .all();
  return (rows[0]?.n ?? 0) === 0;
}

function uniqueViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes("UNIQUE constraint failed");
}

export async function createUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const email = str(formData, "email").toLowerCase();
  const username = str(formData, "username");
  const password = String(formData.get("password") ?? "");
  const role = str(formData, "role") === "admin" ? "admin" : "owner";

  const invalid = validateIdentity(email, username);
  if (invalid) return { error: invalid, ok: false };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, ok: false };
  }

  const emailTaken = db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .all();
  if (emailTaken.length > 0) return { error: "That email is already in use.", ok: false };

  const usernameTaken = db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
    .all();
  if (usernameTaken.length > 0) return { error: "That username is already in use.", ok: false };

  try {
    db.insert(users)
      .values({ email, username, passwordHash: hashSync(password, 12), role })
      .run();
  } catch (err) {
    if (uniqueViolation(err)) return { error: "Email or username already in use.", ok: false };
    return { error: "Failed to create user.", ok: false };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { error: null, ok: true };
}

export async function updateUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid user.", ok: false };

  const target = db.select().from(users).where(eq(users.id, id)).limit(1).all()[0];
  if (!target) return { error: "User not found.", ok: false };

  const email = str(formData, "email").toLowerCase();
  const username = str(formData, "username");
  const role = str(formData, "role") === "admin" ? "admin" : "owner";
  const active = formData.get("active") !== null;
  const password = String(formData.get("password") ?? "");

  const invalid = validateIdentity(email, username);
  if (invalid) return { error: invalid, ok: false };
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      ok: false,
    };
  }

  const emailClash = db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, ne(users.id, id)))
    .all();
  if (emailClash.length > 0) return { error: "That email is already in use.", ok: false };

  const usernameClash = db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.username}) = ${username.toLowerCase()}`, ne(users.id, id)))
    .all();
  if (usernameClash.length > 0) return { error: "That username is already in use.", ok: false };

  // Guard rails — never lock yourself (or the marina) out of the admin panel.
  if (target.id === admin.id) {
    if (role !== "admin") return { error: "You cannot demote your own account.", ok: false };
    if (!active) return { error: "You cannot disable your own account.", ok: false };
  } else if (target.role === "admin" && target.active && (role !== "admin" || !active)) {
    if (isLastActiveAdmin(target.id)) {
      return {
        error: "This is the last active admin — demote or disable another admin first.",
        ok: false,
      };
    }
  }

  try {
    db.update(users)
      .set({
        email,
        username,
        role,
        active,
        updatedAt: new Date(),
        // Admin-set password reset: blank field = keep current password.
        ...(password ? { passwordHash: hashSync(password, 12) } : {}),
      })
      .where(eq(users.id, id))
      .run();
  } catch (err) {
    if (uniqueViolation(err)) return { error: "Email or username already in use.", ok: false };
    return { error: "Failed to update user.", ok: false };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { error: null, ok: true };
}

export async function deleteUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid user.", ok: false };
  if (id === admin.id) return { error: "You cannot delete your own account.", ok: false };

  const target = db.select().from(users).where(eq(users.id, id)).limit(1).all()[0];
  if (!target) return { error: "User not found.", ok: false };

  // Assigned meters become unassigned automatically (ON DELETE SET NULL).
  db.delete(users).where(eq(users.id, id)).run();

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/admin/meters");
  return { error: null, ok: true };
}
