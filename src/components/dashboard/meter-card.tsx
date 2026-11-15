"use client";

import type { MeterReading } from "@/lib/api-types";
import { formatKwh, formatPower } from "@/lib/format";

import { RelativeTime } from "./relative-time";

function StatusChip({
  unavailable,
  partial = false,
  label,
}: {
  unavailable: boolean;
  partial?: boolean;
  label?: string;
}) {
  if (unavailable) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        {label ?? "unavailable"}
      </span>
    );
  }
  if (partial) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
      live
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
  const kwh = formatKwh(reading.energy.kwhAdjusted);

  // Sensor age = newest of the two sensor timestamps.
  const lastSensorUpdate = [
    reading.power.lastUpdated,
    reading.energy.lastUpdated,
  ]
    .filter((value): value is string => typeof value === "string")
    .sort()
    .at(-1) ?? null;

  const allUnavailable = reading.power.unavailable && reading.energy.unavailable;
  const partialUnavailable = !allUnavailable && (reading.power.unavailable || reading.energy.unavailable);

  return (
    <section aria-label={reading.meterName} className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{reading.meterName}</h2>
        <StatusChip
          unavailable={allUnavailable}
          partial={partialUnavailable}
          label={allUnavailable ? "no data" : partialUnavailable ? "partial" : undefined}
        />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-500">Power now</p>
          <StatusChip unavailable={reading.power.unavailable} />
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
          <StatusChip unavailable={reading.energy.unavailable} />
        </div>
        {kwh ? (
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {kwh}{" "}
            <span className="text-lg font-medium text-slate-500">kWh</span>
          </p>
        ) : (
          <p className="mt-1 text-2xl font-semibold text-slate-300" aria-label="no data">
            —
          </p>
        )}
        <p className="mt-1 truncate text-xs text-slate-400">
          {reading.energy.friendlyName ?? reading.energy.entityId}
          {reading.kwhOffset > 0 ? ` · offset −${reading.kwhOffset} kWh` : ""}
          {" · "}
          <RelativeTime iso={reading.energy.lastUpdated} nowMs={nowMs} />
        </p>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Sensor update: <RelativeTime iso={lastSensorUpdate} nowMs={nowMs} />
      </p>
    </section>
  );
}
