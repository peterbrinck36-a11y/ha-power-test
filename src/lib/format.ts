/** Client-safe display formatters (locale-independent dot decimals on purpose). */

export function formatPower(watts: number | null): { value: string; unit: string } | null {
  if (watts === null || !Number.isFinite(watts)) return null;
  if (Math.abs(watts) >= 1000) {
    return { value: (watts / 1000).toFixed(2), unit: "kW" };
  }
  return { value: (Math.round(watts * 10) / 10).toFixed(1), unit: "W" };
}

export function formatKwh(kwh: number | null): string | null {
  if (kwh === null || !Number.isFinite(kwh)) return null;
  return kwh.toFixed(2);
}

/** "just now" / "12s ago" / "5m ago" / "3h ago" / "2d ago" — or "—" when unknown. */
export function relativeTime(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";

  let seconds = Math.floor((nowMs - then) / 1000);
  if (seconds < 0) seconds = 0; // clock skew guard

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
