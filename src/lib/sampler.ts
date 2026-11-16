import "server-only";

import { eq, isNull, sql } from "drizzle-orm";

import { db } from "./db";
import { getHaStates } from "./ha/client";
import { parseNumeric, toKwh, toWatts, unitOf } from "./ha/parse";
import { meterAssignments, meters, meterState, readings } from "./schema";

const DEFAULT_INTERVAL_MS = 120_000;
const MIN_INTERVAL_MS = 5_000;
const KICKOFF_DELAY_MS = 5_000;

export type SampleResult = {
  startedAt: string;
  meters: number;
  recorded: boolean;
  degraded: boolean;
  error: string | null;
};

/**
 * Process-wide sampler state. Kept on `globalThis` so dev-mode module reloads
 * and repeated instrumentation registration can never start two loops.
 */
const singleton = globalThis as typeof globalThis & {
  __marinaSampler?: {
    started: boolean;
    timer: ReturnType<typeof setInterval> | null;
    running: boolean;
  };
};

function samplerState() {
  singleton.__marinaSampler ??= { started: false, timer: null, running: false };
  return singleton.__marinaSampler;
}

/** Sample cadence: `SAMPLE_INTERVAL_MS` (default 2 minutes), clamped to ≥5s. */
export function sampleIntervalMs(): number {
  const raw = Number(process.env.SAMPLE_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(raw)) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.floor(raw));
}

/**
 * One sampling pass over every meter: read all HA states through the shared
 * client (5s cache + single-flight), store a reading per meter, and credit the
 * positive energy delta to that meter's open assignment.
 *
 * The first sample a meter ever gets only establishes the delta baseline, so
 * the HA counter's pre-existing total is never counted as consumption. A gap
 * (container down, HA unreachable) is recovered on the next good sample
 * because the delta is measured against the last stored value.
 */
export async function sampleOnce(): Promise<SampleResult> {
  const sampler = samplerState();
  const startedAt = new Date().toISOString();

  if (sampler.running) {
    return {
      startedAt,
      meters: 0,
      recorded: false,
      degraded: false,
      error: "a sample is already running",
    };
  }
  sampler.running = true;

  try {
    const meterRows = db.select().from(meters).all();
    const result = await getHaStates();
    const byEntity = new Map(result.states.map((state) => [state.entity_id, state] as const));

    const openAssignments = db
      .select()
      .from(meterAssignments)
      .where(isNull(meterAssignments.endedAt))
      .all();
    const assignmentByMeter = new Map(
      openAssignments.map((assignment) => [assignment.meterId, assignment] as const),
    );

    const previousStates = db.select().from(meterState).all();
    const previousByMeter = new Map(
      previousStates.map((state) => [state.meterId, state] as const),
    );

    const recordedAt = new Date();

    db.transaction((tx) => {
      for (const meter of meterRows) {
        const powerState = byEntity.get(meter.powerEntityId);
        const energyState = byEntity.get(meter.energyEntityId);

        const power = parseNumeric(powerState);
        const energy = parseNumeric(energyState);

        const powerW =
          power.value === null ? null : toWatts(power.value, unitOf(powerState ?? null));
        const energyKwh =
          energy.value === null ? null : toKwh(energy.value, unitOf(energyState ?? null));

        const previous = previousByMeter.get(meter.id);

        let deltaKwh: number | null = null;
        if (energyKwh !== null) {
          // Negative deltas mean the HA counter reset — ignore rather than
          // overcount; the next samples continue from the new counter value.
          deltaKwh =
            previous?.lastEnergyKwh == null
              ? 0
              : Math.max(0, energyKwh - previous.lastEnergyKwh);
        }

        const energyAvailable = !energy.unavailable;
        // Keep the last known counter when a sensor is temporarily missing, so
        // a gap resumes from the right baseline instead of restarting at 0.
        const lastEnergyKwh = energyKwh ?? previous?.lastEnergyKwh ?? null;

        tx.insert(readings)
          .values({
            meterId: meter.id,
            recordedAt,
            powerW,
            energyKwh,
            deltaKwh,
            powerAvailable: !power.unavailable,
            energyAvailable,
          })
          .run();

        tx.insert(meterState)
          .values({
            meterId: meter.id,
            lastEnergyKwh,
            lastEnergyAvailable: energyAvailable,
            lastSampledAt: recordedAt,
          })
          .onConflictDoUpdate({
            target: meterState.meterId,
            set: { lastEnergyKwh, lastEnergyAvailable: energyAvailable, lastSampledAt: recordedAt },
          })
          .run();

        const assignment = assignmentByMeter.get(meter.id);
        if (assignment && deltaKwh !== null && deltaKwh > 0) {
          tx.update(meterAssignments)
            .set({ consumedKwh: sql`${meterAssignments.consumedKwh} + ${deltaKwh}` })
            .where(eq(meterAssignments.id, assignment.id))
            .run();
        }
      }
    });

    return {
      startedAt,
      meters: meterRows.length,
      recorded: true,
      degraded: result.degraded,
      error: result.error,
    };
  } finally {
    sampler.running = false;
  }
}

/**
 * Starts the always-on background sampler. Called once from
 * `src/instrumentation.ts` when the server process boots — never from a page
 * or route, and never during `next build`.
 */
export function startSampler(): void {
  const sampler = samplerState();
  if (sampler.started) return;
  if (process.env.SAMPLER_DISABLED === "1") {
    console.log("[sampler] disabled via SAMPLER_DISABLED=1");
    return;
  }

  sampler.started = true;
  const interval = sampleIntervalMs();

  const run = () => {
    void sampleOnce().catch((err) => {
      // A failed pass must never take the web server down.
      console.error("[sampler] sample failed:", err instanceof Error ? err.message : err);
    });
  };

  const kickoff = setTimeout(run, KICKOFF_DELAY_MS);
  kickoff.unref?.();

  sampler.timer = setInterval(run, interval);
  sampler.timer.unref?.();

  console.log(`[sampler] started — sampling every ${interval}ms`);
}
