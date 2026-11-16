/**
 * Client-safe API response types (no secrets, no server-only imports).
 * Shared between server route handlers and client components.
 */

export type SensorOption = {
  entityId: string;
  friendlyName: string | null;
  unit: string | null;
  deviceClass: string | null;
};

export type EntityReading = {
  entityId: string;
  friendlyName: string | null;
  unit: string | null;
  lastUpdated: string | null;
  /** True when the sensor is missing, `unavailable`, `unknown`, or non-numeric. */
  unavailable: boolean;
};

export type PowerReading = EntityReading & {
  /** Live power normalized to watts, straight from Home Assistant. */
  watts: number | null;
};

export type EnergyReading = EntityReading & {
  /**
   * kWh accumulated in our own database since the current owner was assigned
   * (null while the meter is unassigned). This is NOT the HA lifetime counter.
   */
  kwhTotal: number | null;
  /** When the background sampler last recorded this meter. */
  sampledAt: string | null;
};

export type MeterReading = {
  meterId: number;
  meterName: string;
  /** Start of the current ownership period — the consumption baseline. */
  assignmentStartedAt: string | null;
  power: PowerReading;
  energy: EnergyReading;
};

export type ReadingsResponse = {
  readings: MeterReading[];
  degraded: boolean;
  error: string | null;
  fetchedAt: string;
  serverTime: string;
  /**
   * The signed-in owner's month-to-date consumption + category. Null for admins
   * (their dashboard is a preview of every owner's meter) and while no
   * categories are configured.
   */
  month: CategoryMonthSummary | null;
};

/** Palette keys accepted by `src/lib/category-colors.ts`. */
export type CategoryColor =
  | "slate"
  | "amber"
  | "zinc"
  | "yellow"
  | "emerald"
  | "sky"
  | "rose";

/** A configured consumption tier, ordered by `minKwh` ascending. */
export type CategoryTier = {
  id: number;
  name: string;
  /** Inclusive lower bound in kWh. */
  minKwh: number;
  color: CategoryColor;
};

export type CategoryMonthSummary = {
  /** "November 2026" in the marina time zone. */
  label: string;
  /** ISO instant of the local month start. */
  monthStart: string;
  /** Month-to-date kWh across all of the owner's meters, rounded to 3 decimals. */
  totalKwh: number;
  /** Highest reached tier; null only while the total is below the first tier. */
  current: CategoryTier | null;
  /** Next tier up (with the kWh still needed); null in the top tier. */
  next: (CategoryTier & { remainingKwh: number }) | null;
  /** 0..1 progress through the current tier (1 once the top tier is reached). */
  progress: number;
};

export type SensorsResponse = {
  sensors: SensorOption[];
  degraded: boolean;
  error: string | null;
  fetchedAt: string;
};
