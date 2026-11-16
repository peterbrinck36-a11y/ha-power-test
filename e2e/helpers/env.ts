/** Single source of truth for E2E server env + paths (shared with playwright.config.ts). */
import os from "node:os";
import path from "node:path";

export const PORT = 3100;
export const baseURL = `http://localhost:${PORT}`;

/**
 * Throwaway SQLite file, unique per run — never deleted from config (Windows
 * locks make unlinking unreliable), old runs simply accumulate in %TEMP%.
 *
 * The config process generates the path first; Playwright workers inherit
 * process.env, so seeding helpers resolve the exact same file.
 */
function resolveE2eDbPath(): string {
  if (process.env.E2E_DB_PATH) return process.env.E2E_DB_PATH;
  const generated = path.join(os.tmpdir(), `marina-e2e-${Date.now()}.db`);
  process.env.E2E_DB_PATH = generated;
  return generated;
}

export const e2eDbPath = resolveE2eDbPath();

export const adminEmail = "admin@marina.test";
export const adminPassword = "e2e-admin-pass";

export const serverEnv: Record<string, string> = {
  // process.env wins over the standalone .env file (dotenv semantics), so
  // these override whatever was baked into the build.
  PORT: String(PORT),
  DATABASE_PATH: e2eDbPath,
  HA_MOCK_FILE: path.resolve("docs/ha-sample.json"),
  ADMIN_EMAIL: adminEmail,
  ADMIN_PASSWORD: adminPassword,
  SESSION_SECRET: "e2e-only-secret-never-used-in-production",
  COOKIE_SECURE: "auto",
  // The whole suite logs in many times from one IP — relax the limiter.
  MAX_LOGIN_ATTEMPTS: "1000",
  // The background sampler is triggered explicitly per test (POST
  // /api/admin/sample) so assertions are deterministic.
  SAMPLER_DISABLED: "1",
};
