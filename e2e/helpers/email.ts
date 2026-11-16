import fs from "node:fs";

import { emailCapturePath } from "./env";

export type CapturedEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  at: string;
};

/**
 * Reads the JSONL capture file written by the app when EMAIL_CAPTURE_FILE is
 * set. The file is unique per E2E run and lives in %TEMP%.
 */
export function readCapturedEmails(): CapturedEmail[] {
  if (!fs.existsSync(emailCapturePath)) return [];
  return fs
    .readFileSync(emailCapturePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as CapturedEmail);
}

/** Polls the capture file until a matching email appears (latest match wins). */
export async function waitForEmail(
  predicate: (email: CapturedEmail) => boolean,
  timeoutMs = 10_000,
): Promise<CapturedEmail> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = readCapturedEmails()
      .reverse()
      .find(predicate);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Timed out waiting for a captured email matching the predicate.");
}
