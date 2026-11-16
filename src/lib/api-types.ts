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
  /** Live power normalized to watts. */
  watts: number | null;
};

export type EnergyReading = EntityReading & {
  /** Raw total from the meter, normalized to kWh (Wh/MWh sensors converted). */
  kwhTotal: number | null;
  /** `kwhTotal − kwhOffset`, clamped at 0 — what the boat owner sees. */
  kwhAdjusted: number | null;
};

export type MeterReading = {
  meterId: number;
  meterName: string;
  kwhOffset: number;
  power: PowerReading;
  energy: EnergyReading;
};

export type ReadingsResponse = {
  readings: MeterReading[];
  degraded: boolean;
  error: string | null;
  fetchedAt: string;
  serverTime: string;
};

export type SensorsResponse = {
  sensors: SensorOption[];
  degraded: boolean;
  error: string | null;
  fetchedAt: string;
};
