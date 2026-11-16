/**
 * Calendar-month boundaries in the marina's local time zone.
 *
 * Consumption categories are "month to date", so the window has to follow the
 * wall clock people actually use — not UTC — and that means the boundaries move
 * with daylight saving. We resolve the local start-of-month to an absolute
 * instant with the standard iterate-until-stable offset trick.
 */

export const DEFAULT_TIME_ZONE = "Europe/Copenhagen";

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** The configured marina time zone (`APP_TIMEZONE`, default Europe/Copenhagen). */
export function appTimeZone(): string {
  const configured = process.env.APP_TIMEZONE?.trim();
  return configured && isValidTimeZone(configured) ? configured : DEFAULT_TIME_ZONE;
}

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallClock(date: Date, timeZone: string): WallClock {
  const values = new Map<string, number>();
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") values.set(part.type, Number(part.value));
  }
  return {
    year: values.get("year") ?? 1970,
    month: values.get("month") ?? 1,
    day: values.get("day") ?? 1,
    hour: values.get("hour") ?? 0,
    minute: values.get("minute") ?? 0,
    second: values.get("second") ?? 0,
  };
}

/**
 * Absolute instant whose wall clock in `timeZone` is the given local date/time.
 * Ambiguous (DST fold) times resolve to the earlier instant; skipped times land
 * just after the transition, which is fine for month boundaries.
 */
function wallClockToInstant(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, 0, 0, 0);
  let instant = target;
  for (let i = 0; i < 3; i += 1) {
    const wall = wallClock(new Date(instant), timeZone);
    const wallAsUtc = Date.UTC(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour,
      wall.minute,
      wall.second,
    );
    const offset = wallAsUtc - instant;
    const next = target - offset;
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

export type MonthRange = {
  /** Inclusive start instant (local 1st, 00:00). */
  start: Date;
  /** Exclusive end instant (local 1st of the next month, 00:00). */
  end: Date;
  /** Human label, e.g. "November 2026". */
  label: string;
  /** Calendar key, e.g. "2026-11". */
  key: string;
  timeZone: string;
};

export function monthRange(now: Date = new Date(), timeZone: string = appTimeZone()): MonthRange {
  const current = wallClock(now, timeZone);
  const start = wallClockToInstant(current.year, current.month, 1, timeZone);

  const nextYear = current.month === 12 ? current.year + 1 : current.year;
  const nextMonth = current.month === 12 ? 1 : current.month + 1;
  const end = wallClockToInstant(nextYear, nextMonth, 1, timeZone);

  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    month: "long",
    year: "numeric",
  }).format(start);

  return {
    start,
    end,
    label,
    key: `${current.year}-${String(current.month).padStart(2, "0")}`,
    timeZone,
  };
}
