"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { db, sqlite } from "@/lib/db";
import { resetEnergyBaseline } from "@/lib/meters";
import { localDayRange, parseLocalDateKey } from "@/lib/month";
import { meterAssignments, readings } from "@/lib/schema";
import { sampleOnce } from "@/lib/sampler";

function integerField(formData: FormData, key: string): number | null {
  const value = Number(formData.get(key));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function decimalField(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function revalidateAfterChange(ownerId: number | null): void {
  for (const path of [
    "/admin/debug",
    "/admin/reports",
    "/dashboard",
    "/admin/meters",
    "/admin/users",
  ]) {
    revalidatePath(path);
  }
  if (ownerId !== null) revalidatePath(`/admin/users/${ownerId}`);
}

function openAssignmentRow(meterId: number) {
  return (
    db
      .select()
      .from(meterAssignments)
      .where(and(eq(meterAssignments.meterId, meterId), isNull(meterAssignments.endedAt)))
      .limit(1)
      .all()[0] ?? null
  );
}

/**
 * Replaces each submitted day's stored kWh with a single synthetic reading at
 * local noon. Keeps the open assignment's running total in sync when the day
 * belongs to that assignment, so the dashboard and the reports agree.
 */
export async function saveDailyTotals(formData: FormData): Promise<void> {
  await requireAdmin();
  const meterId = integerField(formData, "meterId");
  if (meterId === null) return;

  const open = openAssignmentRow(meterId);
  let consumedDelta = 0;

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("day:")) continue;
    const isoDate = key.slice("day:".length);
    const range = localDayRange(isoDate);
    if (!range) continue;
    const next = decimalField(value);
    if (next === null || next < 0) continue;

    const currentRow = sqlite
      .prepare(
        `select coalesce(sum(delta_kwh), 0) as kwh from readings
          where meter_id = ? and recorded_at >= ? and recorded_at < ?`,
      )
      .get(meterId, range.start.getTime(), range.end.getTime()) as { kwh: number };
    const current = Number(currentRow.kwh) || 0;
    const roundedCurrent = Math.round(current * 1000) / 1000;
    const roundedNext = Math.round(next * 1000) / 1000;
    if (Math.abs(roundedCurrent - roundedNext) < 0.0005) continue;

    sqlite
      .prepare("delete from readings where meter_id = ? and recorded_at >= ? and recorded_at < ?")
      .run(meterId, range.start.getTime(), range.end.getTime());

    const recordedAt = range.start.getTime() + 12 * 60 * 60 * 1000;
    sqlite
      .prepare(
        `insert into readings
           (meter_id, recorded_at, power_w, energy_kwh, delta_kwh, power_available, energy_available)
         values (?, ?, null, null, ?, 0, 0)`,
      )
      .run(meterId, recordedAt, roundedNext);

    if (open && open.startedAt.getTime() <= recordedAt && open.endedAt === null) {
      consumedDelta += roundedNext - roundedCurrent;
    }
  }

  if (open && consumedDelta !== 0) {
    db.update(meterAssignments)
      .set({
        consumedKwh: Math.max(0, open.consumedKwh + consumedDelta),
      })
      .where(eq(meterAssignments.id, open.id))
      .run();
  }

  revalidateAfterChange(open?.ownerId ?? null);
}

/** Rewrites the open assignment's start date and running total. */
export async function saveAssignment(formData: FormData): Promise<void> {
  await requireAdmin();
  const meterId = integerField(formData, "meterId");
  if (meterId === null) return;
  const open = openAssignmentRow(meterId);
  if (!open) return;

  const startedAtValue =
    typeof formData.get("startedAt") === "string" ? String(formData.get("startedAt")) : "";
  if (!parseLocalDateKey(startedAtValue)) return;
  const range = localDayRange(startedAtValue);
  if (!range) return;

  const consumed = decimalField(formData.get("consumedKwh"));
  if (consumed === null || consumed < 0) return;

  db.update(meterAssignments)
    .set({ startedAt: range.start, consumedKwh: consumed })
    .where(eq(meterAssignments.id, open.id))
    .run();

  revalidateAfterChange(open.ownerId);
}

/** Runs one sampler pass immediately (same code path as the background loop). */
export async function sampleNow(): Promise<void> {
  await requireAdmin();
  await sampleOnce();
  revalidateAfterChange(null);
}

/** Forgets the stored energy counter so the next sample records a 0 delta. */
export async function resetBaseline(formData: FormData): Promise<void> {
  await requireAdmin();
  const meterId = integerField(formData, "meterId");
  if (meterId === null) return;
  resetEnergyBaseline(meterId);
  revalidateAfterChange(openAssignmentRow(meterId)?.ownerId ?? null);
}

/** Deletes all stored samples for a meter and zeroes its running total. */
export async function clearReadings(formData: FormData): Promise<void> {
  await requireAdmin();
  const meterId = integerField(formData, "meterId");
  if (meterId === null) return;
  const open = openAssignmentRow(meterId);
  db.delete(readings).where(eq(readings.meterId, meterId)).run();
  if (open) {
    db.update(meterAssignments)
      .set({ consumedKwh: 0 })
      .where(eq(meterAssignments.id, open.id))
      .run();
  }
  revalidateAfterChange(open?.ownerId ?? null);
}
