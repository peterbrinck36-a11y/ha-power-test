"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ReadingsResponse } from "@/lib/api-types";

import { CategoryCard } from "./category-card";
import { MeterCard } from "./meter-card";
import { RelativeTime } from "./relative-time";

const POLL_INTERVAL_MS = 10_000;

/**
 * Polls /api/ha/readings every 10s and renders meter cards from state only —
 * no page navigation, so nothing flickers. Pauses while the tab is hidden and
 * refreshes immediately when it becomes visible again.
 */
export function DashboardClient() {
  const [data, setData] = useState<ReadingsResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return; // never overlap polls
    inFlight.current = true;
    try {
      const res = await fetch("/api/ha/readings", { cache: "no-store" });
      if (res.status === 401) {
        // Session expired mid-view — go log in again.
        window.location.assign("/login");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ReadingsResponse;
      setData(json);
      setFetchError(null);
      setReceivedAt(Date.now());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Network error");
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  // 1s ticker so "Xs ago" labels stay fresh without refetching.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4">
      {data ? (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <span>
            Auto-refreshes every 10s · refreshed{" "}
            <RelativeTime
              iso={receivedAt === null ? null : new Date(receivedAt).toISOString()}
              nowMs={nowMs}
            />
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="font-medium text-sky-600 hover:underline"
          >
            Refresh now
          </button>
        </p>
      ) : null}

      {fetchError ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Couldn&apos;t refresh readings ({fetchError}) — retrying automatically.
        </p>
      ) : null}

      {data?.degraded ? (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          Home Assistant is unreachable — sensors will show as unavailable.
          {data.error ? ` (${data.error})` : null}
        </p>
      ) : null}

      {data?.month ? <CategoryCard month={data.month} /> : null}

      {!data ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">Loading readings…</p>
        </div>
      ) : data.readings.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-medium text-slate-900">No meters assigned yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Contact the marina admin to get your boat&apos;s shore-power meter connected.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.readings.map((reading) => (
            <MeterCard key={reading.meterId} reading={reading} nowMs={nowMs} />
          ))}
        </div>
      )}
    </div>
  );
}
