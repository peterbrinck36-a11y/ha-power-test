"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState } from "@/lib/forms";
import { meters, users } from "@/lib/schema";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function parseOffset(raw: string): number | null {
  if (raw === "") return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
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
  offset: number | null,
): string | null {
  if (!name) return "Enter a name / slip label.";
  if (!powerEntityId) return "Choose or enter a power sensor entity_id.";
  if (!energyEntityId) return "Choose or enter an energy sensor entity_id.";
  if (offset === null) return "kWh offset must be a number ≥ 0.";
  return null;
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
  const offset = parseOffset(str(formData, "kwhOffset"));

  const invalid = validateMeterFields(name, powerEntityId, energyEntityId, offset);
  if (invalid) return { error: invalid, ok: false };

  if (ownerId !== null) {
    const owner = db.select({ id: users.id }).from(users).where(eq(users.id, ownerId)).all()[0];
    if (!owner) return { error: "Selected owner no longer exists.", ok: false };
  }

  db.insert(meters)
    .values({
      name,
      powerEntityId,
      energyEntityId,
      ownerId,
      kwhOffset: offset ?? 0,
    })
    .run();

  revalidatePath("/admin/meters");
  revalidatePath("/admin");
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
  const offset = parseOffset(str(formData, "kwhOffset"));

  const invalid = validateMeterFields(name, powerEntityId, energyEntityId, offset);
  if (invalid) return { error: invalid, ok: false };

  if (ownerId !== null) {
    const owner = db.select({ id: users.id }).from(users).where(eq(users.id, ownerId)).all()[0];
    if (!owner) return { error: "Selected owner no longer exists.", ok: false };
  }

  db.update(meters)
    .set({
      name,
      powerEntityId,
      energyEntityId,
      ownerId,
      kwhOffset: offset ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(meters.id, id))
    .run();

  revalidatePath("/admin/meters");
  revalidatePath("/admin");
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

  db.delete(meters).where(eq(meters.id, id)).run();

  revalidatePath("/admin/meters");
  revalidatePath("/admin");
  return { error: null, ok: true };
}
