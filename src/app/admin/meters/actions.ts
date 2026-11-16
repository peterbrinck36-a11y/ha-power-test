"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import { resetEnergyBaseline, syncAssignment } from "@/lib/meters";
import { meters, users } from "@/lib/schema";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function resolveOwner(raw: string): number | null {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateMeterFields(
  name: string,
  powerEntityId: string,
  energyEntityId: string,
): string | null {
  if (!name) return "Enter a name / slip label.";
  if (!powerEntityId) return "Choose or enter a power sensor entity_id.";
  if (!energyEntityId) return "Choose or enter an energy sensor entity_id.";
  return null;
}

function ownerExists(ownerId: number): boolean {
  return (
    db.select({ id: users.id }).from(users).where(eq(users.id, ownerId)).all().length > 0
  );
}

export async function createMeter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const name = str(formData, "name");
  const powerEntityId = str(formData, "powerEntityId");
  const energyEntityId = str(formData, "energyEntityId");
  const ownerId = resolveOwner(str(formData, "ownerId"));

  const invalid = validateMeterFields(name, powerEntityId, energyEntityId);
  if (invalid) return { error: invalid, ok: false };

  if (ownerId !== null && !ownerExists(ownerId)) {
    return { error: "Selected owner no longer exists.", ok: false };
  }

  const created = db
    .insert(meters)
    .values({ name, powerEntityId, energyEntityId, ownerId })
    .returning({ id: meters.id })
    .get();

  // A new meter assigned right away starts its consumption at 0.
  syncAssignment(created.id, ownerId);

  revalidatePath("/admin/meters");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

export async function updateMeter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid meter.", ok: false };

  const existing = db.select().from(meters).where(eq(meters.id, id)).limit(1).all()[0];
  if (!existing) return { error: "Meter not found.", ok: false };

  const name = str(formData, "name");
  const powerEntityId = str(formData, "powerEntityId");
  const energyEntityId = str(formData, "energyEntityId");
  const ownerId = resolveOwner(str(formData, "ownerId"));

  const invalid = validateMeterFields(name, powerEntityId, energyEntityId);
  if (invalid) return { error: invalid, ok: false };

  if (ownerId !== null && !ownerExists(ownerId)) {
    return { error: "Selected owner no longer exists.", ok: false };
  }

  db.update(meters)
    .set({ name, powerEntityId, energyEntityId, ownerId, updatedAt: new Date() })
    .where(eq(meters.id, id))
    .run();

  // Owner change = new ownership period at 0. Same owner = untouched total.
  syncAssignment(id, ownerId);

  // Pointing the meter at a different energy counter invalidates the stored
  // baseline; the next sample starts a fresh one (the running total is kept).
  if (existing.energyEntityId !== energyEntityId) resetEnergyBaseline(id);

  revalidatePath("/admin/meters");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

export async function deleteMeter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Invalid meter.", ok: false };

  const existing = db.select().from(meters).where(eq(meters.id, id)).limit(1).all()[0];
  if (!existing) return { error: "Meter not found.", ok: false };

  // Assignments, meter_state and readings cascade with the meter.
  db.delete(meters).where(eq(meters.id, id)).run();

  revalidatePath("/admin/meters");
  revalidatePath("/admin");
  return { error: null, ok: true };
}
