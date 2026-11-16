import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Encrypts the stored Gmail app password with AES-256-GCM.
 *
 * The key is derived from EMAIL_SECRET (recommended) or SESSION_SECRET. Storing
 * the credential encrypted keeps it out of casual SQLite browsing and backups;
 * rotating the signing secret means the admin must re-enter the app password
 * (the app then reports that clearly instead of failing silently).
 */

const PREFIX = "v1";
const SALT = "marina-email-settings-v1";

function encryptionKey(): Buffer {
  const secret = process.env.EMAIL_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "EMAIL_SECRET (or SESSION_SECRET) must be set to store email credentials.",
    );
  }
  return scryptSync(secret, SALT, 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecret(stored: string): string {
  const [version, ivB64, tagB64, dataB64] = stored.split(":");
  if (version !== PREFIX || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Stored email password has an unsupported format — re-enter it.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
