import "server-only";

import type { HaFetchResult } from "./types";

const TTL_MS = 5_000;

type Entry = {
  value: Promise<HaFetchResult>;
  expiresAt: number;
};

const cache = new Map<string, Entry>();

/**
 * Tiny TTL cache with single-flight: concurrent callers within the TTL share
 * one in-flight promise, so multiple logged-in boat owners refreshing never
 * spam Home Assistant. Failed fetches are dropped so the next request retries.
 */
export function getOrFetch(
  key: string,
  fetcher: () => Promise<HaFetchResult>,
): Promise<HaFetchResult> {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.value;
  }

  const promise = fetcher();
  cache.set(key, { value: promise, expiresAt: now + TTL_MS });
  promise.then(
    () => undefined,
    () => cache.delete(key),
  );
  return promise;
}
