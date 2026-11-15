#!/usr/bin/env node
/**
 * Prepares the standalone build for direct `node server.js` runs (local
 * verification and Playwright E2E — mirrors what the Dockerfile does):
 *   1. copies .next/static into .next/standalone/.next/static
 *   2. makes HA_MOCK_FILE absolute inside .next/standalone/.env, because the
 *      standalone server's cwd is .next/standalone
 *
 * Run `npm run build` first. Used by `npm run test:e2e` via playwright.config.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticSrc = path.join(root, ".next/static");
const staticDest = path.join(root, ".next/standalone/.next/static");
const standaloneEnvPath = path.join(root, ".next/standalone/.env");

if (!fs.existsSync(path.join(root, ".next/standalone/server.js"))) {
  console.error(
    "[prepare-standalone] .next/standalone/server.js not found — run `npm run build` first.",
  );
  process.exit(1);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// 1. Static assets (Next standalone does not copy them itself).
copyDir(staticSrc, staticDest);

// 2. Absolute mock path inside the standalone .env.
const absoluteMock = path.join(root, "docs/ha-sample.json").replace(/\\/g, "/");
const env = fs.readFileSync(standaloneEnvPath, "utf8");
const patched = env
  .split(/\r?\n/)
  .map((line) =>
    line.startsWith("HA_MOCK_FILE=") ? `HA_MOCK_FILE=${absoluteMock}` : line,
  )
  .join("\n");
fs.writeFileSync(standaloneEnvPath, patched);

console.log("[prepare-standalone] static copied + HA_MOCK_FILE absolutized");
