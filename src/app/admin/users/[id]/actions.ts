"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncAssignment } from "@/lib/meters";
import { meters } from "@/lib/schema";

function revalidateUser(userId: number): void {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/meters");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

function numberField(formData: FormData, key: string): number | null {
  const value = Number(formData.get(key));
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** Attaches an existing (currently unassigned) meter to this user. */
export async function assignMeterToUser(formData: FormData): Promise<void> {
  await requireAdmin();

  const userId = numberField(formData, "userId");
  const meterId = numberField(formData, "meterId");
  if (userId === null || meterId === null) return;

  const meter = db.select().from(meters).where(eq(meters.id, meterId)).all()[0];
  if (!meter || meter.ownerId !== null) return;

  db.update(meters)
    .set({ ownerId: userId, updatedAt: new Date() })
    .where(eq(meters.id, meterId))
    .run();
  syncAssignment(meterId, userId);

  revalidateUser(userId);
}

/** Detaches a meter from this user, closing its consumption period. */
export async function unassignMeterFromUser(formData: FormData): Promise<void> {
  await requireAdmin();

  const userId = numberField(formData, "userId");
  const meterId = numberField(formData, "meterId");
  if (userId === null || meterId === null) return;

  const meter = db.select().from(meters).where(eq(meters.id, meterId)).all()[0];
  if (!meter || meter.ownerId !== userId) return;

  db.update(meters)
    .set({ ownerId: null, updatedAt: new Date() })
    .where(eq(meters.id, meterId))
    .run();
  syncAssignment(meterId, null);

  revalidateUser(userId);
}
