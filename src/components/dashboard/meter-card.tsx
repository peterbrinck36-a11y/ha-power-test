"use client";

import type { MeterReading } from "@/lib/api-types";
import { formatKwh, formatPower } from "@/lib/format";

import { RelativeTime } from "./relative-time";

/** A sample older than this is flagged as stale (2× the default 2-minute cadence). */
const STALE_AFTER_MS = 5 * 60 * 1000;

type ChipTone = "live" | "warn" | "muted";

function Chip({ tone, label }: { tone: ChipTone; label: string }) {
  const classes =
    tone === "live"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "muted"
        ? "bg-slate-100 text-slate-600"
        : "bg-amber-100 text-amber-700";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {tone === "live" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

export function MeterCard({
  reading,
  nowMs,
}: {
  reading: MeterReading;
  nowMs: number;
}) {
  const power = formatPower(reading.power.watts);
  const kwh = formatKwh(reading.energy.kwhTotal);

  const sampledMs = reading.energy.sampledAt ? Date.parse(reading.energy.sampledAt) : null;
  const stale = sampledMs !== null && nowMs - sampledMs > STALE_AFTER_MS;

  // Sensor age = newest of the two sensor timestamps.
  const lastSensorUpdate = [
    reading.power.lastUpdated,
    reading.energy.sampledAt,
  ]
    .filter((value): value is string => typeof value === "string")
    .sort()
    .at(-1) ?? null;

  const powerUnavailable = reading.power.unavailable;
  const energyUnavailable = reading.energy.unavailable;
  const allUnavailable = powerUnavailable && energyUnavailable;
  const partialUnavailable = !allUnavailable && (powerUnavailable || energyUnavailable);

  let energyChip: { tone: ChipTone; label: string };
  if (!reading.assignmentStartedAt) {
    energyChip = { tone: "muted", label: "unassigned" };
  } else if (reading.energy.sampledAt === null) {
    energyChip = { tone: "warn", label: "waiting for sample" };
  } else if (energyUnavailable) {
    energyChip = { tone: "warn", label: "no data" };
  } else if (stale) {
    energyChip = { tone: "warn", label: "stale" };
  } else {
    energyChip = { tone: "live", label: "live" };
  }

  return (
    <section aria-label={reading.meterName} className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{reading.meterName}</h2>
        <Chip
          tone={allUnavailable ? "warn" : partialUnavailable ? "warn" : "live"}
          label={allUnavailable ? "no data" : partialUnavailable ? "partial" : "live"}
        />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-500">Power now</p>
          <Chip
            tone={powerUnavailable ? "warn" : "live"}
            label={powerUnavailable ? "unavailable" : "live"}
          />
        </div>
        {power ? (
          <p className="mt-1 text-4xl font-semibold tabular-nums text-slate-900">
            {power.value}{" "}
            <span className="text-2xl font-medium text-slate-500">{power.unit}</span>
          </p>
        ) : (
          <p className="mt-1 text-4xl font-semibold text-slate-300" aria-label="no data">
            —
          </p>
        )}
        <p className="mt-1 truncate text-xs text-slate-400">
          {reading.power.friendlyName ?? reading.power.entityId}
          {" · "}
          <RelativeTime iso={reading.power.lastUpdated} nowMs={nowMs} />
        </p>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-500">Total consumed</p>
          <Chip tone={energyChip.tone} label={energyChip.label} />
        </div>
        {kwh ? (
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {kwh} <span className="text-lg font-medium text-slate-500">kWh</span>
          </p>
        ) : (
          <p className="mt-1 text-2xl font-semibold text-slate-300" aria-label="no data">
            —
          </p>
        )}
        <p className="mt-1 truncate text-xs text-slate-400">
          {reading.assignmentStartedAt
            ? `Since ${new Date(reading.assignmentStartedAt).toLocaleDateString()}`
            : "Not assigned to an owner"}
          {reading.energy.sampledAt ? (
            <>
              {" · "}
              sampled <RelativeTime iso={reading.energy.sampledAt} nowMs={nowMs} />
            </>
          ) : null}
        </p>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Sensor update: <RelativeTime iso={lastSensorUpdate} nowMs={nowMs} />
      </p>
    </section>
  );
}
