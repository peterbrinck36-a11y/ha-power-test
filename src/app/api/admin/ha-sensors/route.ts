import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { getHaStates } from "@/lib/ha/client";
import { friendlyName, unitOf } from "@/lib/ha/parse";
import type { HaState } from "@/lib/ha/types";
import type { SensorsResponse, SensorOption } from "@/lib/api-types";

export const dynamic = "force-dynamic";

const POWER_UNITS = new Set(["w", "kw"]);
const ENERGY_UNITS = new Set(["wh", "kwh", "mwh"]);

function isPowerOrEnergySensor(state: HaState): boolean {
  const deviceClass = state.attributes?.device_class;
  if (deviceClass === "power" || deviceClass === "energy") return true;

  const unit = unitOf(state)?.toLowerCase() ?? "";
  return POWER_UNITS.has(unit) || ENERGY_UNITS.has(unit);
}

/** Admin-only picker feed: power/energy sensors discovered in Home Assistant. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await getHaStates();

  const sensors: SensorOption[] = result.states
    .filter(isPowerOrEnergySensor)
    .map((state) => ({
      entityId: state.entity_id,
      friendlyName: friendlyName(state),
      unit: unitOf(state),
      deviceClass: state.attributes?.device_class ?? null,
    }))
    .sort((a, b) =>
      (a.friendlyName ?? a.entityId).localeCompare(b.friendlyName ?? b.entityId),
    );

  const payload: SensorsResponse = {
    sensors,
    degraded: result.degraded,
    error: result.error,
    fetchedAt: result.fetchedAt,
  };
  return NextResponse.json(payload);
}
