/**
 * Next.js instrumentation hook — runs once per server process at boot (and is
 * bundled into the standalone output). This is the only place the background
 * sampler is started, so `next build` workers never spawn timers.
 */
export async function register(): Promise<void> {
  // Instrumentation also runs in the edge runtime; the sampler needs Node.
  if (process.env.NEXT_RUNTIME === "edge") return;
  // Defensive: never start background work during a production build.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { startSampler } = await import("./lib/sampler");
  startSampler();
}
