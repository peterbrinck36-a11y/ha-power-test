import "server-only";

import { and, inArray, isNull } from "drizzle-orm";

import type { MeterReading, ReadingsResponse } from "@/lib/api-types";
import { db } from "@/lib/db";
import type { Meter } from "@/lib/schema";
import { meterAssignments, meterState } from "@/lib/schema";

import { getHaStates } from "./client";
import { friendlyName, lastUpdated, parseNumeric, toWatts, unitOf } from "./parse";

/**
 * Builds owner-safe readings for the given meters.
 *
 * Power is live (Home Assistant, 5s cache). The consumed total is *ours*: the
 * sampler's accumulated `consumed_kwh` for the meter's open assignment, i.e.
 * since the current owner was assigned — never the HA counter's lifetime total.
 */
export async function buildReadings(
  meters: Meter[],
): Promise<Omit<ReadingsResponse, "month">> {
  const result = await getHaStates();
  const byEntity = new Map(result.states.map((state) => [state.entity_id, state] as const));

  const meterIds = meters.map((meter) => meter.id);

  const assignments =
    meterIds.length === 0
      ? []
      : db
          .select()
          .from(meterAssignments)
          .where(
            and(inArray(meterAssignments.meterId, meterIds), isNull(meterAssignments.endedAt)),
          )
          .all();
  const assignmentByMeter = new Map(
    assignments.map((assignment) => [assignment.meterId, assignment] as const),
  );

  const sampledStates =
    meterIds.length === 0
      ? []
      : db
          .select()
          .from(meterState)
          .where(inArray(meterState.meterId, meterIds))
          .all();
  const sampledByMeter = new Map(sampledStates.map((state) => [state.meterId, state] as const));

  const readings: MeterReading[] = meters.map((meter) => {
    const powerState = byEntity.get(meter.powerEntityId);
    const energyState = byEntity.get(meter.energyEntityId);

    const power = parseNumeric(powerState);
    const sampled = sampledByMeter.get(meter.id) ?? null;
    const assignment = assignmentByMeter.get(meter.id) ?? null;

    const powerUnit = unitOf(powerState);
    const sampledAt = sampled?.lastSampledAt ? sampled.lastSampledAt.toISOString() : null;

    return {
      meterId: meter.id,
      meterName: meter.name,
      assignmentStartedAt: assignment ? assignment.startedAt.toISOString() : null,
      power: {
        entityId: meter.powerEntityId,
        friendlyName: friendlyName(powerState),
        unit: powerUnit,
        watts: power.value === null ? null : toWatts(power.value, powerUnit),
        lastUpdated: lastUpdated(powerState),
        unavailable: power.unavailable,
      },
      energy: {
        entityId: meter.energyEntityId,
        friendlyName: friendlyName(energyState),
        unit: "kWh",
        // Accumulated by our sampler since the current assignment started.
        kwhTotal: assignment ? assignment.consumedKwh : null,
        lastUpdated: sampledAt,
        sampledAt,
        // No assignment → no owner total; no sample yet → nothing to show.
        unavailable: !assignment || !sampled || !sampled.lastEnergyAvailable,
      },
    };
  });

  return {
    readings,
    degraded: result.degraded,
    error: result.error,
    fetchedAt: result.fetchedAt,
    serverTime: new Date().toISOString(),
  };
}
