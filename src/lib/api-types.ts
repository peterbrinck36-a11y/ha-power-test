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
};

export type SensorsResponse = {
  sensors: SensorOption[];
  degraded: boolean;
  error: string | null;
  fetchedAt: string;
};
