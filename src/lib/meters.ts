import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "./db";
import { meterAssignments, meterState } from "./schema";

/**
 * Ownership-period helpers. The open assignment row (ended_at IS NULL) is the
 * meter's current total; every owner change closes it and opens a fresh row at
 * `consumed_kwh = 0`, which is the automatic consumption reset.
 */

export function getOpenAssignment(meterId: number) {
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
 * Makes the meter's open assignment match `ownerId`:
 * - same owner → no-op (editing a meter must not wipe a month)
 * - different owner / unassigned → close the current period, open a new one at 0
 */
export function syncAssignment(meterId: number, ownerId: number | null): void {
  const open = getOpenAssignment(meterId);
  if ((open?.ownerId ?? null) === ownerId) return;

  const now = new Date();
  if (open) {
    db.update(meterAssignments)
      .set({ endedAt: now })
      .where(eq(meterAssignments.id, open.id))
      .run();
  }

  if (ownerId !== null) {
    db.insert(meterAssignments)
      .values({ meterId, ownerId, startedAt: now, consumedKwh: 0 })
      .run();
  }
}

/**
 * Forgets the stored energy counter without touching the accumulated total —
 * used when a meter is pointed at a different energy sensor, so the next
 * sample establishes a new baseline instead of producing a bogus delta.
 */
export function resetEnergyBaseline(meterId: number): void {
  db.update(meterState)
    .set({ lastEnergyKwh: null, lastEnergyAvailable: false })
    .where(eq(meterState.meterId, meterId))
    .run();
}
