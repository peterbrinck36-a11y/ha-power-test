import Link from "next/link";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { db, sqlite } from "@/lib/db";
import { localDateKey, localDayRange, localTimestampKey, previousLocalDateKey } from "@/lib/month";

import {
  clearReadings,
  resetBaseline,
  sampleNow,
  saveAssignment,
  saveDailyTotals,
} from "./actions";

export const metadata = { title: "Debug — Marina Admin" };

const MAX_DAYS = 62;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const fieldClasses =
  "mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-500/30";
const labelClasses = "text-sm text-ink-secondary";
const primaryButtonClasses =
  "rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600";
const secondaryButtonClasses =
  "rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-muted";

type MeterRow = {
  id: number;
  name: string;
  owner: string | null;
  assignment_id: number | null;
  started_at: number | null;
  consumed_kwh: number | null;
};

type ReadingRow = {
  id: number;
  recorded_at: number;
  power_w: number | null;
  delta_kwh: number | null;
  energy_kwh: number | null;
};

function asString(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function localDateDaysAgo(days: number): string {
  return localDateKey(new Date(Date.now() - days * 86_400_000));
}

export default async function DebugPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const today = localDateKey(new Date());
  const defaultFrom = localDateDaysAgo(13);

  const meterRows = sqlite
    .prepare(
      `select m.id,
              m.name,
              u.username as owner,
              a.id as assignment_id,
              a.started_at,
              a.consumed_kwh
         from meters m
         left join meter_assignments a
           on a.meter_id = m.id and a.ended_at is null
         left join users u on u.id = a.owner_id
        order by m.name`,
    )
    .all() as MeterRow[];

  const requestedMeter = Number(asString(query.meter));
  const selected =
    meterRows.find((row) => row.id === requestedMeter) ?? meterRows[0] ?? null;
  const from = asString(query.from) || defaultFrom;
  const to = asString(query.to) || today;

  const warnings: string[] = [];
  let days: { key: string; start: Date; end: Date }[] = [];
  if (selected) {
    if (!localDayRange(from) || !localDayRange(to)) {
      warnings.push("Pick valid dates for the daily editor.");
    } else if (from > to) {
      warnings.push("The daily editor needs a start date on or before the end date.");
    } else {
      let cursor = to;
      while (cursor >= from && days.length < MAX_DAYS) {
        const range = localDayRange(cursor);
        if (!range) break;
        days.push(range);
        cursor = previousLocalDateKey(cursor);
      }
      if (cursor >= from) {
        warnings.push(`Showing the most recent ${MAX_DAYS} days; narrow the range to edit the rest.`);
      }
    }
  }

  const dayTotals = new Map<string, { kwh: number; samples: number }>();
  const recentReadings: ReadingRow[] = [];
  if (selected) {
    if (days.length > 0) {
      const start = days[days.length - 1].start.getTime();
      const end = days[0].end.getTime();
      const rows = sqlite
        .prepare(
          `select recorded_at, delta_kwh from readings
            where meter_id = ? and recorded_at >= ? and recorded_at < ?`,
        )
        .all(selected.id, start, end) as { recorded_at: number; delta_kwh: number | null }[];
      for (const row of rows) {
        const key = localDateKey(new Date(row.recorded_at));
        const current = dayTotals.get(key) ?? { kwh: 0, samples: 0 };
        current.kwh += row.delta_kwh ?? 0;
        current.samples += 1;
        dayTotals.set(key, current);
      }
    }

    recentReadings.push(
      ...(sqlite
        .prepare(
          `select id, recorded_at, power_w, delta_kwh, energy_kwh from readings
            where meter_id = ? order by recorded_at desc limit 10`,
        )
        .all(selected.id) as ReadingRow[]),
    );
  }

  const selectedName = selected?.name ?? "this meter";

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Testing tools
        </span>
        <h1 className="mt-1 text-xl font-semibold text-ink">Debug</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Directly edit the stored history so you can test categories, reports and the
          dashboard without waiting for real consumption. Admin-only; every change is
          applied immediately.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        These tools rewrite readings and assignment totals. Use them on test data only —
        real consumption history cannot be reconstructed afterwards.
      </div>

      {warnings.map((warning) => (
        <p
          key={warning}
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          {warning}
        </p>
      ))}

      <form method="get" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label htmlFor="debug-meter" className={labelClasses}>
            Meter
            <select id="debug-meter" name="meter" defaultValue={selected ? String(selected.id) : ""} className={fieldClasses}>
              {meterRows.length === 0 ? <option value="">No meters</option> : null}
              {meterRows.map((meter) => (
                <option key={meter.id} value={meter.id}>
                  {meter.name}
                  {meter.owner ? ` — ${meter.owner}` : " — unassigned"}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="debug-from" className={labelClasses}>
            From
            <input id="debug-from" name="from" type="date" defaultValue={from} className={fieldClasses} />
          </label>
          <label htmlFor="debug-to" className={labelClasses}>
            To
            <input id="debug-to" name="to" type="date" defaultValue={to} className={fieldClasses} />
          </label>
          <div className="flex items-end">
            <button type="submit" className={secondaryButtonClasses}>
              Show meter
            </button>
          </div>
        </div>
      </form>

      {selected ? (
        <>
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Daily consumption (kWh)</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Set the total for a day; saving replaces that day&apos;s samples with one
              synthetic reading at local noon and adjusts the owner&apos;s running total.
            </p>
            <form action={saveDailyTotals} className="mt-4 space-y-4">
              <input type="hidden" name="meterId" value={selected.id} />
              <div className="max-h-96 overflow-y-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">kWh</th>
                      <th className="px-4 py-2 text-right">Samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day) => {
                      const total = dayTotals.get(day.key);
                      return (
                        <tr key={day.key} className="border-b border-line last:border-0">
                          <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-ink-muted">
                            {day.key}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              name={`day:${day.key}`}
                              type="text"
                              inputMode="decimal"
                              defaultValue={(total?.kwh ?? 0).toFixed(3)}
                              aria-label={`kWh for ${day.key}`}
                              className="w-28 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-500/30"
                            />
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-ink-muted">
                            {total?.samples ?? 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button type="submit" className={primaryButtonClasses}>
                Save daily totals
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Assignment</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Change when the current owner got {selectedName} and its running total.
            </p>
            {selected.assignment_id ? (
              <form action={saveAssignment} className="mt-4 grid gap-4 sm:grid-cols-3">
                <input type="hidden" name="meterId" value={selected.id} />
                <div className="sm:col-span-3">
                  <p className="text-sm text-ink-secondary">
                    Owner: <span className="font-medium text-ink">{selected.owner}</span>
                  </p>
                </div>
                <label htmlFor="debug-started-at" className={labelClasses}>
                  Assigned since
                  <input
                    id="debug-started-at"
                    name="startedAt"
                    type="date"
                    defaultValue={localDateKey(new Date(selected.started_at ?? Date.now()))}
                    className={fieldClasses}
                  />
                </label>
                <label htmlFor="debug-consumed" className={labelClasses}>
                  Total consumed (kWh)
                  <input
                    id="debug-consumed"
                    name="consumedKwh"
                    type="text"
                    inputMode="decimal"
                    defaultValue={(selected.consumed_kwh ?? 0).toFixed(3)}
                    className={fieldClasses}
                  />
                </label>
                <div className="flex items-end">
                  <button type="submit" className={primaryButtonClasses}>
                    Save assignment
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">
                This meter is not assigned. Assign it on{" "}
                <Link href="/admin/meters" className="text-sky-700 hover:underline dark:text-sky-300">
                  Meters
                </Link>{" "}
                first.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Quick actions</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <form action={sampleNow}>
                <button type="submit" className={secondaryButtonClasses}>
                  Sample now
                </button>
              </form>
              <form action={resetBaseline}>
                <input type="hidden" name="meterId" value={selected.id} />
                <button type="submit" className={secondaryButtonClasses}>
                  Reset energy baseline
                </button>
              </form>
              <form action={clearReadings}>
                <input type="hidden" name="meterId" value={selected.id} />
                <ConfirmSubmit
                  message={`Delete every stored reading for ${selectedName} and set its running total to 0?`}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                >
                  Clear readings
                </ConfirmSubmit>
              </form>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Latest readings</h2>
            {recentReadings.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No readings stored for this meter yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                      <th className="px-3 py-2">Recorded (local)</th>
                      <th className="px-3 py-2 text-right">Power</th>
                      <th className="px-3 py-2 text-right">Energy</th>
                      <th className="px-3 py-2 text-right">Δ kWh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentReadings.map((reading) => (
                      <tr key={reading.id} className="border-b border-line last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink-muted">
                          {localTimestampKey(new Date(reading.recorded_at))}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">
                          {reading.power_w === null ? "—" : `${(reading.power_w / 1000).toFixed(2)} kW`}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">
                          {reading.energy_kwh === null ? "—" : `${reading.energy_kwh.toFixed(3)} kWh`}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">
                          {reading.delta_kwh === null ? "—" : reading.delta_kwh.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-muted">
          Create a meter first.
        </p>
      )}
    </div>
  );
}
