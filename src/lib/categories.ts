import "server-only";

import { asc } from "drizzle-orm";

import { db, sqlite } from "@/lib/db";
import { categories } from "@/lib/schema";
import { isCategoryColor } from "@/lib/category-colors";
import { monthRange, type MonthRange } from "@/lib/month";
import type { CategoryMonthSummary, CategoryTier } from "@/lib/api-types";

/** All configured tiers, ascending by threshold (the admin UI's ordering). */
export function listCategories(): CategoryTier[] {
  return db
    .select()
    .from(categories)
    .orderBy(asc(categories.minKwh))
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      minKwh: row.minKwh,
      color: isCategoryColor(row.color) ? row.color : "slate",
    }));
}

export type ResolvedCategory = {
  current: CategoryTier | null;
  next: (CategoryTier & { remainingKwh: number }) | null;
  progress: number;
};

function roundKwh(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Which tier a month-to-date total falls into.
 *
 * Returns `current: null` when the total is below the first tier — we do not
 * force a 0-kWh tier, so a marina that only defined "Silver 100 kWh" still
 * works, it just shows everyone as not ranked yet. Progress is measured through
 * the current tier so the card can show "how close to the next one".
 */
export function resolveCategory(
  tiers: CategoryTier[],
  totalKwh: number,
): ResolvedCategory {
  if (tiers.length === 0) {
    return { current: null, next: null, progress: 0 };
  }

  const sorted = [...tiers].sort((a, b) => a.minKwh - b.minKwh);
  const current =
    [...sorted].reverse().find((tier) => tier.minKwh <= totalKwh) ?? null;
  const nextTier = sorted.find((tier) => tier.minKwh > totalKwh) ?? null;

  if (!nextTier) {
    return { current, next: null, progress: 1 };
  }

  const remainingKwh = round2(nextTier.minKwh - totalKwh);
  if (!current) {
    const span = nextTier.minKwh;
    return {
      current: null,
      next: { ...nextTier, remainingKwh },
      progress: span > 0 ? clamp01(totalKwh / span) : 0,
    };
  }

  const span = nextTier.minKwh - current.minKwh;
  return {
    current,
    next: { ...nextTier, remainingKwh },
    progress: span > 0 ? clamp01((totalKwh - current.minKwh) / span) : 1,
  };
}

/**
 * Month-to-date kWh for one owner: every reading, in the month, joined to the
 * assignment that was active when it was recorded. That is what makes the total
 * follow the person rather than the meter, and it resets by construction when
 * the assignment is reset (new period starts at 0).
 */
export function monthKwhForOwner(
  ownerId: number,
  range: MonthRange,
  handle: typeof sqlite = sqlite,
): number {
  const row = handle
    .prepare(
      `select coalesce(sum(r.delta_kwh), 0) as kwh
       from readings r
       join meter_assignments a
         on a.meter_id = r.meter_id
        and r.recorded_at >= a.started_at
        and (a.ended_at is null or r.recorded_at < a.ended_at)
       where a.owner_id = ?
         and r.recorded_at >= ?
         and r.recorded_at < ?`,
    )
    .get(ownerId, range.start.getTime(), range.end.getTime()) as
    | { kwh: number }
    | undefined;

  return roundKwh(row?.kwh ?? 0);
}

/**
 * Month-to-date kWh for every owner with at least one reading, in one query.
 * Used by the admin "Owner view" preview; owners use `getMonthSummary`.
 */
export function monthKwhByOwner(
  range: MonthRange,
  handle: typeof sqlite = sqlite,
): Map<number, number> {
  const rows = handle
    .prepare(
      `select a.owner_id as ownerId, coalesce(sum(r.delta_kwh), 0) as kwh
       from readings r
       join meter_assignments a
         on a.meter_id = r.meter_id
        and r.recorded_at >= a.started_at
        and (a.ended_at is null or r.recorded_at < a.ended_at)
       where a.owner_id is not null
         and r.recorded_at >= ?
         and r.recorded_at < ?
       group by a.owner_id`,
    )
    .all(range.start.getTime(), range.end.getTime()) as {
    ownerId: number;
    kwh: number;
  }[];

  return new Map(rows.map((row) => [row.ownerId, roundKwh(row.kwh)]));
}

/**
 * The owner-facing month summary. Null while no categories are configured (the
 * dashboard card stays hidden) — and for admins, who see per-meter data only.
 */
export function getMonthSummary(
  ownerId: number,
  now: Date = new Date(),
): CategoryMonthSummary | null {
  const tiers = listCategories();
  if (tiers.length === 0) return null;

  const range = monthRange(now);
  const totalKwh = monthKwhForOwner(ownerId, range);
  const { current, next, progress } = resolveCategory(tiers, totalKwh);

  return {
    label: range.label,
    monthStart: range.start.toISOString(),
    totalKwh,
    current,
    next,
    progress,
  };
}
