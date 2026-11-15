import { relativeTime } from "@/lib/format";

/** Pure relative-time label — the parent re-renders each second with a fresh `nowMs`. */
export function RelativeTime({
  iso,
  nowMs,
}: {
  iso: string | null | undefined;
  nowMs: number;
}) {
  // Rendering is client-only (data arrives via fetch), so Date math here is safe.
  return <span>{relativeTime(iso, nowMs)}</span>;
}
