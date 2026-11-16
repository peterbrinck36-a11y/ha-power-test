import "server-only";

import type { HaState } from "./types";

const UNAVAILABLE_STATES = new Set(["unavailable", "unknown"]);

export function friendlyName(state: HaState | null | undefined): string | null {
  const name = state?.attributes?.friendly_name;
  return typeof name === "string" && name.trim().length > 0 ? name : null;
}

export function unitOf(state: HaState | null | undefined): string | null {
  const unit = state?.attributes?.unit_of_measurement;
  return typeof unit === "string" && unit.length > 0 ? unit : null;
}

export function lastUpdated(state: HaState | undefined): string | null {
  return state?.last_updated ?? state?.last_changed ?? null;
}

export type ParsedNumber = {
  value: number | null;
  unavailable: boolean;
};

/** HA states are strings — coerce defensively; `unavailable`/`unknown`/garbage → null. */
export function parseNumeric(state: HaState | undefined): ParsedNumber {
  if (!state) return { value: null, unavailable: true };

  const raw = state.state?.trim() ?? "";
  if (UNAVAILABLE_STATES.has(raw.toLowerCase())) {
    return { value: null, unavailable: true };
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return { value: null, unavailable: true };
  }
  return { value, unavailable: false };
}

/** Normalize kW readings to W (everything else assumed to already be W). */
export function toWatts(value: number, unit: string | null): number {
  return unit?.toLowerCase() === "kw" ? value * 1000 : value;
}

/**
 * Normalize an energy reading to kWh. HA energy sensors commonly report Wh or
 * kWh (occasionally MWh); anything unrecognised is assumed to already be kWh.
 */
export function toKwh(value: number, unit: string | null): number {
  switch (unit?.trim().toLowerCase()) {
    case "wh":
      return value / 1000;
    case "mwh":
      return value * 1000;
    default:
      return value;
  }
}


