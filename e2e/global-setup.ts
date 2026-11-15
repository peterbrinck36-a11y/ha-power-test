import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { baseURL, serverEnv } from "./helpers/env";

/**
 * Playwright's built-in webServer teardown hangs on Windows with the Next.js
 * standalone server (the server spawns a worker child that inherits the stdio
 * pipes), so we manage the server process ourselves with taskkill /T /F.
 */
const pidFile = path.join(process.cwd(), "test-results", "e2e-server.pid");

async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return;
    } catch {
      // server not up yet — retry
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`E2E server did not become healthy within ${timeoutMs}ms (${url})`);
}

export default async function globalSetup(): Promise<void> {
  // 1. Fresh static assets + absolute HA_MOCK_FILE in the standalone bundle.
  execSync("node scripts/prepare-standalone.mjs", { stdio: "inherit" });

  // 2. Spawn the standalone server with the E2E environment.
  const child = spawn(process.execPath, [".next/standalone/server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, ...serverEnv },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  // Drain stdio so server logs can never backpressure-block the server.
  child.stdout?.resume();
  child.stderr?.resume();
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[e2e] server exited unexpectedly with code ${code}`);
    }
  });

  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(child.pid));

  // 3. Wait until the app reports healthy.
  await waitForHealth(`${baseURL}/api/health`, 60_000);
  console.log(`[e2e] server ready on ${baseURL} (pid ${child.pid})`);
}
