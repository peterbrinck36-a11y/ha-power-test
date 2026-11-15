/**
 * Home Assistant server-domain types. Server-side only — HA responses never
 * reach the browser raw; the API layer maps them to `src/lib/api-types.ts`.
 */

export type HaAttributes = {
  friendly_name?: string;
  unit_of_measurement?: string;
  device_class?: string;
  state_class?: string;
  [key: string]: unknown;
};

export type HaState = {
  entity_id: string;
  state: string;
  attributes?: HaAttributes;
  last_changed?: string;
  last_reported?: string;
  last_updated?: string;
};

export type HaFetchResult = {
  states: HaState[];
  /** True when HA (or the mock file) could not be read — callers must degrade gracefully. */
  degraded: boolean;
  error: string | null;
  fetchedAt: string;
};
