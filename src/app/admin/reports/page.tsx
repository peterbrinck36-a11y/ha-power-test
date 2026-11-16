import Link from "next/link";

import { localDateKey } from "@/lib/month";
import {
  ReportError,
  buildReport,
  listReportUsers,
  parseReportParams,
  type ReportGranularity,
  type ReportResult,
} from "@/lib/reports";

export const metadata = { title: "Reports — Marina Admin" };

const DISPLAY_ROW_LIMIT = 500;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function asString(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function asNumberList(value: string | string[] | undefined): number[] {
  const list = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return list.map(Number).filter((item) => Number.isInteger(item) && item > 0);
}

function formatKwh(value: number): string {
  return `${value.toFixed(2)} kWh`;
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const today = localDateKey(new Date());
  const defaultFrom = `${today.slice(0, 7)}-01`;

  const users = listReportUsers();
  const selectedIds = new Set(asNumberList(query.users));
  const from = asString(query.from) || defaultFrom;
  const to = asString(query.to) || today;
  const rawGranularity = asString(query.granularity);
  const granularity: ReportGranularity =
    rawGranularity === "hourly" ? "hourly" : rawGranularity === "raw" ? "raw" : "daily";

  const submitted = query.submitted === "1" || query.users !== undefined;
  let error: string | null = null;
  let result: ReportResult | null = null;

  if (submitted) {
    const parsed = parseReportParams({
      users: query.users,
      from,
      to,
      granularity,
    });
    if ("error" in parsed) {
      error = parsed.error;
    } else {
      try {
        result = buildReport(parsed.params);
      } catch (cause) {
        error =
          cause instanceof ReportError
            ? cause.message
            : "Could not load the report. Check the server logs.";
      }
    }
  }

  const exportQuery = new URLSearchParams();
  if (result) {
    for (const id of result.params.userIds) exportQuery.append("users", String(id));
    exportQuery.set("from", result.params.from);
    exportQuery.set("to", result.params.to);
    exportQuery.set("granularity", result.params.granularity);
  }

  const visibleRows = result ? result.rows.slice(0, DISPLAY_ROW_LIMIT) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Reports</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Pull stored consumption for one or more users over a date range and export it as CSV.
          Totals come from the sampler&apos;s own database, so they work while Home Assistant is
          offline.
        </p>
      </div>

      <form method="get" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <input type="hidden" name="submitted" value="1" />

        <fieldset>
          <legend className="text-sm font-medium text-ink">Users</legend>
          {users.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">No users exist yet.</p>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink-secondary hover:bg-surface-muted"
                >
                  <input
                    type="checkbox"
                    name="users"
                    value={user.id}
                    defaultChecked={selectedIds.has(user.id)}
                  />
                  <span className="truncate">
                    {user.username}
                    <span className="ml-1 text-ink-muted">({user.email})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label htmlFor="report-from" className="text-sm text-ink-secondary">
            From
            <input
              id="report-from"
              name="from"
              type="date"
              defaultValue={from}
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-500/30"
            />
          </label>
          <label htmlFor="report-to" className="text-sm text-ink-secondary">
            To (inclusive)
            <input
              id="report-to"
              name="to"
              type="date"
              defaultValue={to}
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-500/30"
            />
          </label>
          <label htmlFor="report-granularity" className="text-sm text-ink-secondary">
            Detail
            <select
              id="report-granularity"
              name="granularity"
              defaultValue={granularity}
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-500/30"
            >
              <option value="daily">Daily totals</option>
              <option value="hourly">Hourly totals</option>
              <option value="raw">Raw samples</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600"
          >
            Load data
          </button>
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      </form>

      {result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-ink-muted">Users</p>
              <p className="mt-1 text-lg font-semibold text-ink">{result.ownerTotals.length}</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-ink-muted">Meters</p>
              <p className="mt-1 text-lg font-semibold text-ink">{result.meters}</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-ink-muted">Consumption</p>
              <p className="mt-1 text-lg font-semibold text-ink">{formatKwh(result.totalKwh)}</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-ink-muted">Samples</p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {result.samples.toLocaleString("en-GB")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              {result.range.label} · {result.range.timeZone} · {result.params.granularity}
            </p>
            {result.rows.length > 0 ? (
              <Link
                href={`/api/admin/reports/export?${exportQuery.toString()}`}
                className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-muted"
                prefetch={false}
              >
                Export CSV
              </Link>
            ) : null}
          </div>

          {result.ownerTotals.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-sm">
              {result.ownerTotals.map((total) => (
                <span
                  key={total.ownerId}
                  className="rounded-full bg-surface-muted px-3 py-1 text-ink-secondary"
                >
                  {total.ownerName}: <span className="font-medium text-ink">{formatKwh(total.kwh)}</span>
                </span>
              ))}
            </div>
          ) : null}

          {result.rows.length === 0 ? (
            <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-muted">
              No readings in this range for the selected users.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Meter</th>
                    <th className="px-4 py-3">
                      {result.params.granularity === "raw" ? "Timestamp" : "Period"}
                    </th>
                    {result.params.granularity === "raw" ? (
                      <>
                        <th className="px-4 py-3 text-right">Power</th>
                        <th className="px-4 py-3 text-right">Energy</th>
                      </>
                    ) : null}
                    <th className="px-4 py-3 text-right">Consumption</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr
                      key={`${row.ownerId}-${row.meterId}-${row.period}`}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-4 py-3 text-ink">{row.ownerName}</td>
                      <td className="px-4 py-3 text-ink-muted">{row.meterName}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-muted">{row.period}</td>
                      {result.params.granularity === "raw" ? (
                        <>
                          <td className="px-4 py-3 text-right tabular-nums text-ink-muted">
                            {row.powerW === null ? "—" : `${(row.powerW / 1000).toFixed(2)} kW`}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-ink-muted">
                            {row.energyKwh === null ? "—" : `${row.energyKwh.toFixed(3)} kWh`}
                          </td>
                        </>
                      ) : null}
                      <td className="px-4 py-3 text-right tabular-nums text-ink">
                        {row.kwh.toFixed(2)} kWh
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.rows.length > DISPLAY_ROW_LIMIT ? (
            <p className="text-sm text-ink-muted">
              Showing the first {DISPLAY_ROW_LIMIT} of {result.rows.length.toLocaleString("en-GB")}{" "}
              rows — export the CSV to get everything.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
