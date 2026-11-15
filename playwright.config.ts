import { defineConfig, devices } from "@playwright/test";

import { baseURL, serverEnv } from "./e2e/helpers/env";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // SQLite single-writer; specs share the seeded DB
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    baseURL,
    trace: "retain-on-failure",
    viewport: { width: 480, height: 900 }, // mobile-first app
  },

  // The E2E server is started/stopped in global-setup/global-teardown
  // (Playwright's webServer teardown hangs on Windows with the Next.js
  // standalone server; see e2e/global-setup.ts).

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 480, height: 900 } },
    },
  ],
});
