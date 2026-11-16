"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { compare, hashSync } from "bcryptjs";

import { getSessionUser, setSessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { users } from "@/lib/schema";

/**
 * Sets the signed-in user's own password. Used by the forced first-login
 * screen: the temporary password stops working, and the session version bump
 * invalidates any other sessions issued with the temporary password.
 */
export async function setPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      ok: false,
    };
  }
  if (password !== confirm) {
    return { error: "The two passwords do not match.", ok: false };
  }
  if (await compare(password, user.passwordHash)) {
    return { error: "Choose a password different from the temporary one.", ok: false };
  }

  const sessionVersion = user.sessionVersion + 1;
  db.update(users)
    .set({
      passwordHash: hashSync(password, 12),
      mustChangePassword: false,
      tempPasswordExpiresAt: null,
      sessionVersion,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .run();

  await setSessionCookie({
    userId: user.id,
    role: user.role,
    username: user.username,
    sv: sessionVersion,
  });

  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}
