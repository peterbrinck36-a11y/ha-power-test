import { randomInt } from "node:crypto";

import { TEMP_PASSWORD_TTL_MS } from "./password-policy";

/** Length of generated temporary passwords (strong, copy-pasteable). */
export const TEMP_PASSWORD_LENGTH = 16;

// No O/0, I/l/1 — avoids transcription mistakes when someone types it by hand.
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTemporaryPassword(): string {
  let password = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i += 1) {
    password += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  }
  return password;
}

export function tempPasswordExpiry(now = new Date()): Date {
  return new Date(now.getTime() + TEMP_PASSWORD_TTL_MS);
}
