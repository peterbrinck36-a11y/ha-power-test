import "server-only";

import fs from "node:fs/promises";

import { getOrFetch } from "./cache";
import type { HaFetchResult, HaState } from "./types";

const HA_TIMEOUT_MS = 5_000;

function nowIso(): string {
  return new Date().toISOString();
}

function degraded(error: string): HaFetchResult {
  return { states: [], degraded: true, error, fetchedAt: nowIso() };
}

async function fetchFromLiveHa(): Promise<HaFetchResult> {
  const haUrl = process.env.HA_URL?.trim();
  const token = process.env.HA_TOKEN?.trim();

  if (!haUrl || !token) {
    return degraded("HA_URL / HA_TOKEN not configured");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HA_TIMEOUT_MS);

  try {
    const response = await fetch(`${haUrl.replace(/\/+$/, "")}/api/states`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return degraded(`Home Assistant responded with HTTP ${response.status}`);
    }

    const states = (await response.json()) as HaState[];
    if (!Array.isArray(states)) {
      return degraded("Home Assistant returned an unexpected payload");
    }
    return { states, degraded: false, error: null, fetchedAt: nowIso() };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return degraded(`Home Assistant unreachable: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

async function readMockFile(): Promise<HaFetchResult> {
  const mockPath = process.env.HA_MOCK_FILE?.trim() ?? "";
  try {
    // Strip a UTF-8 BOM if present (Windows/PowerShell exports often have one).
    const raw = (await fs.readFile(/* turbopackIgnore: true */ mockPath, "utf8")).replace(/^\uFEFF/, "");
    const states = JSON.parse(raw) as HaState[];
    if (!Array.isArray(states)) {
      return degraded("HA_MOCK_FILE does not contain a JSON array");
    }
    return { states, degraded: false, error: null, fetchedAt: nowIso() };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return degraded(`Failed to read HA_MOCK_FILE (${mockPath}): ${reason}`);
  }
}

/**
 * The single entry point for HA state reads. Uses HA_MOCK_FILE when set
 * (offline dev / Playwright tests), otherwise the live HA API. Results are
 * cached for 5s with single-flight — never call HA from anywhere else.
 */
export function getHaStates(): Promise<HaFetchResult> {
  if (process.env.HA_MOCK_FILE?.trim()) {
    return getOrFetch("mock", readMockFile);
  }
  return getOrFetch("live", fetchFromLiveHa);
}
