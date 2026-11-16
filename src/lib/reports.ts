/**
 * Admin reporting: pull stored sampler readings for one or more boat owners
 * over an arbitrary local date range, either aggregated (daily/hourly) or as
 * raw samples, and render them as a table or CSV.
 *
 * A reading is attributed to the owner whose assignment window contains the
 * sample (the same rule the monthly categories and the dashboard use), so
 * reassigning a meter mid-range splits the numbers correctly.
 */
import "server-only";

import { db, sqlite } from "@/lib/db";
import {
  appTimeZone,
  localDateKey,
  localDateToInstant,
  localHourKey,
  localTimestampKey,
} from "@/lib/month";
import { users } from "@/lib/schema";

export type ReportGranularity = "daily" | "hourly" | "raw";

export type ReportUser = { id: number; username: string; email: string };

export type ReportParams = {
  userIds: number[];
  from: string;
  to: string;
  granularity: ReportGranularity;
};

export type ReportRange = {
  /** Inclusive start instant (local midnight of `from`). */
  start: Date;
  /** Exclusive end instant (local midnight after `to`). */
  end: Date;
  from: string;
  to: string;
  label: string;
  timeZone: string;
};

export type ReportRow = {
  ownerId: number;
  ownerName: string;
  ownerEmail: string;
  meterId: number;
  meterName: string;
  period: string;
  kwh: number;
  samples: number;
  /** Raw samples only. */
  powerW: number | null;
  energyKwh: number | null;
};

export type ReportOwnerTotal = {
  ownerId: number;
  ownerName: string;
  kwh: number;
  samples: number;
  meters: number;
};

export type ReportResult = {
  params: ReportParams;
  range: ReportRange;
  rows: ReportRow[];
  ownerTotals: ReportOwnerTotal[];
  totalKwh: number;
  samples: number;
  meters: number;
};

export type ReportSearchParams = Record<string, string | string[] | undefined>;

/** Hard stop on absurd pulls: a year of 2-minute samples across ten meters. */
const MAX_ROWS = 250_000;
const MAX_RANGE_DAYS = 366;

export class ReportError extends Error {}

export function listReportUsers(): ReportUser[] {
  return db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .all()
    .sort((a, b) => a.username.localeCompare(b.username));
}

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function nextDay(date: { year: number; month: number; day: number }): {
  year: number;
  month: number;
  day: number;
} {
  const probe = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return {
    year: probe.getUTCFullYear(),
    month: probe.getUTCMonth() + 1,
    day: probe.getUTCDate(),
  };
}

/** Validates the query string. Returns a message for the user when invalid. */
export function parseReportParams(
  input: ReportSearchParams,
): { params: ReportParams } | { error: string } {
  const rawUsers = input.users;
  const list = rawUsers === undefined ? [] : Array.isArray(rawUsers) ? rawUsers : [rawUsers];
  const userIds = [...new Set(list.map((value) => Number(value)))].filter(
    (value) => Number.isInteger(value) && value > 0,
  );
  if (userIds.length === 0) return { error: "Select at least one user." };

  const from = typeof input.from === "string" ? input.from.trim() : "";
  const to = typeof input.to === "string" ? input.to.trim() : "";
  const fromParts = parseIsoDate(from);
  const toParts = parseIsoDate(to);
  if (!fromParts) return { error: "Choose a valid start date." };
  if (!toParts) return { error: "Choose a valid end date." };
  if (to < from) return { error: "The end date must be on or after the start date." };

  const rawGranularity = typeof input.granularity === "string" ? input.granularity : "";
  const granularity: ReportGranularity =
    rawGranularity === "hourly" ? "hourly" : rawGranularity === "raw" ? "raw" : "daily";
  const timeZone = appTimeZone();
  const start = localDateToInstant(fromParts.year, fromParts.month, fromParts.day, timeZone);
  const endParts = nextDay(toParts);
  const end = localDateToInstant(endParts.year, endParts.month, endParts.day, timeZone);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days > MAX_RANGE_DAYS) {
    return { error: `Pick a range of at most ${MAX_RANGE_DAYS} days.` };
  }

  return { params: { userIds, from, to, granularity } };
}

export function reportRange(params: ReportParams): ReportRange {
  const fromParts = parseIsoDate(params.from);
  const toParts = parseIsoDate(params.to);
  if (!fromParts || !toParts) throw new ReportError("Invalid report dates.");
  const timeZone = appTimeZone();
  const start = localDateToInstant(fromParts.year, fromParts.month, fromParts.day, timeZone);
  const endParts = nextDay(toParts);
  const end = localDateToInstant(endParts.year, endParts.month, endParts.day, timeZone);
  return {
    start,
    end,
    from: params.from,
    to: params.to,
    label: `${params.from} → ${params.to}`,
    timeZone,
  };
}

type RawRow = {
  meter_id: number;
  meter_name: string;
  owner_id: number;
  username: string;
  email: string;
  recorded_at: number;
  power_w: number | null;
  energy_kwh: number | null;
  delta_kwh: number | null;
};

export function buildReport(params: ReportParams): ReportResult {
  const range = reportRange(params);
  const placeholders = params.userIds.map(() => "?").join(", ");
  const statement = sqlite.prepare(`
    select r.meter_id,
           m.name as meter_name,
           a.owner_id,
           u.username,
           u.email,
           r.recorded_at,
           r.power_w,
           r.energy_kwh,
           r.delta_kwh
      from readings r
      join meters m on m.id = r.meter_id
      join meter_assignments a
        on a.meter_id = r.meter_id
       and r.recorded_at >= a.started_at
       and (a.ended_at is null or r.recorded_at < a.ended_at)
      join users u on u.id = a.owner_id
     where a.owner_id in (${placeholders})
       and r.recorded_at >= ?
       and r.recorded_at < ?
     order by u.username, m.name, r.recorded_at
  `);

  const raw = statement.all(
    ...params.userIds,
    range.start.getTime(),
    range.end.getTime(),
  ) as RawRow[];

  if (raw.length > MAX_ROWS) {
    throw new ReportError(
      `That range contains ${raw.length.toLocaleString("en-GB")} samples (limit ${MAX_ROWS.toLocaleString("en-GB")}). Narrow the dates or pick a coarser granularity.`,
    );
  }

  const rows: ReportRow[] = [];
  const byKey = new Map<string, ReportRow>();

  for (const sample of raw) {
    const when = new Date(sample.recorded_at);
    const period =
      params.granularity === "raw"
        ? localTimestampKey(when, range.timeZone)
        : params.granularity === "hourly"
          ? localHourKey(when, range.timeZone)
          : localDateKey(when, range.timeZone);

    if (params.granularity === "raw") {
      rows.push({
        ownerId: sample.owner_id,
        ownerName: sample.username,
        ownerEmail: sample.email,
        meterId: sample.meter_id,
        meterName: sample.meter_name,
        period,
        kwh: sample.delta_kwh ?? 0,
        samples: 1,
        powerW: sample.power_w,
        energyKwh: sample.energy_kwh,
      });
      continue;
    }

    const key = `${sample.owner_id}|${sample.meter_id}|${period}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.kwh += sample.delta_kwh ?? 0;
      existing.samples += 1;
      continue;
    }
    const row: ReportRow = {
      ownerId: sample.owner_id,
      ownerName: sample.username,
      ownerEmail: sample.email,
      meterId: sample.meter_id,
      meterName: sample.meter_name,
      period,
      kwh: sample.delta_kwh ?? 0,
      samples: 1,
      powerW: null,
      energyKwh: null,
    };
    byKey.set(key, row);
    rows.push(row);
  }

  const totalsByOwner = new Map<
    number,
    { ownerId: number; ownerName: string; kwh: number; samples: number; meterIds: Set<number> }
  >();
  for (const row of rows) {
    const total = totalsByOwner.get(row.ownerId) ?? {
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      kwh: 0,
      samples: 0,
      meterIds: new Set<number>(),
    };
    total.kwh += row.kwh;
    total.samples += row.samples;
    total.meterIds.add(row.meterId);
    totalsByOwner.set(row.ownerId, total);
  }

  const ownerTotals: ReportOwnerTotal[] = [...totalsByOwner.values()]
    .map((total) => ({
      ownerId: total.ownerId,
      ownerName: total.ownerName,
      kwh: total.kwh,
      samples: total.samples,
      meters: total.meterIds.size,
    }))
    .sort((a, b) => a.ownerName.localeCompare(b.ownerName));

  return {
    params,
    range,
    rows,
    ownerTotals,
    totalKwh: ownerTotals.reduce((sum, total) => sum + total.kwh, 0),
    samples: ownerTotals.reduce((sum, total) => sum + total.samples, 0),
    meters: new Set(rows.map((row) => row.meterId)).size,
  };
}

export function reportFilename(params: ReportParams): string {
  return `marina-${params.from}-to-${params.to}-${params.granularity}.csv`;
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** UTF-8 CSV with a BOM so Excel opens the kWh numbers correctly. */
export function reportCsv(result: ReportResult): string {
  const lines: string[] = [];
  if (result.params.granularity === "raw") {
    lines.push("user,email,meter,timestamp,power_w,energy_kwh,delta_kwh");
    for (const row of result.rows) {
      lines.push(
        [
          csvCell(row.ownerName),
          csvCell(row.ownerEmail),
          csvCell(row.meterName),
          csvCell(row.period),
          csvCell(row.powerW ?? ""),
          csvCell(row.energyKwh ?? ""),
          csvCell(row.kwh.toFixed(3)),
        ].join(","),
      );
    }
  } else {
    lines.push("user,email,meter,period,kwh,samples");
    for (const row of result.rows) {
      lines.push(
        [
          csvCell(row.ownerName),
          csvCell(row.ownerEmail),
          csvCell(row.meterName),
          csvCell(row.period),
          csvCell(row.kwh.toFixed(3)),
          csvCell(row.samples),
        ].join(","),
      );
    }
  }
  return `\ufeff${lines.join("\r\n")}\r\n`;
}
