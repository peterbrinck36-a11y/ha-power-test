import "server-only";

import type { Meter } from "@/lib/schema";
import type { MeterReading, ReadingsResponse } from "@/lib/api-types";

import { getHaStates } from "./client";
import { clampOffsetTotal, friendlyName, lastUpdated, parseNumeric, toWatts, unitOf } from "./parse";

/** Build offset-adjusted, owner-safe readings for the given meters. */
export async function buildReadings(meters: Meter[]): Promise<ReadingsResponse> {
  const result = await getHaStates();
  const byEntity = new Map(result.states.map((state) => [state.entity_id, state] as const));

  const readings: MeterReading[] = meters.map((meter) => {
    const powerState = byEntity.get(meter.powerEntityId);
    const energyState = byEntity.get(meter.energyEntityId);

    const power = parseNumeric(powerState);
    const energy = parseNumeric(energyState);
    const powerUnit = powerState ? unitOf(powerState) : null;
    const energyUnit = energyState ? unitOf(energyState) : null;

    const kwhTotal = energy.value;
    const kwhAdjusted =
      kwhTotal === null ? null : clampOffsetTotal(kwhTotal, meter.kwhOffset);

    return {
      meterId: meter.id,
      meterName: meter.name,
      kwhOffset: meter.kwhOffset,
      power: {
        entityId: meter.powerEntityId,
        friendlyName: powerState ? friendlyName(powerState) : null,
        unit: powerUnit,
        watts: power.value === null ? null : toWatts(power.value, powerUnit),
        lastUpdated: lastUpdated(powerState),
        unavailable: power.unavailable,
      },
      energy: {
        entityId: meter.energyEntityId,
        friendlyName: energyState ? friendlyName(energyState) : null,
        unit: energyUnit,
        kwhTotal,
        kwhAdjusted,
        lastUpdated: lastUpdated(energyState),
        unavailable: energy.unavailable,
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
