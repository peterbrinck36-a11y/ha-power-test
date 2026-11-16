import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { appSettings } from "@/lib/schema";

import { decryptSecret, encryptSecret } from "./crypto";

const ADDRESS_KEY = "email.address";
const FROM_NAME_KEY = "email.from_name";
const PASSWORD_KEY = "email.app_password";

export const DEFAULT_FROM_NAME = "Marina Shore Power";

export type EmailSettings = {
  address: string;
  fromName: string;
  /** Decrypted app password, or null when none is stored. */
  appPassword: string | null;
};

/** Browser-safe projection — never includes the app password. */
export type PublicEmailSettings = {
  address: string;
  fromName: string;
  hasPassword: boolean;
  /** False when a password is stored but cannot be decrypted (secret rotated). */
  passwordReadable: boolean;
};

function readValues(keys: string[]): Map<string, string> {
  const rows = db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, keys))
    .all();
  return new Map(rows.map((row) => [row.key, row.value] as const));
}

export function getEmailSettings(): EmailSettings {
  const values = readValues([ADDRESS_KEY, FROM_NAME_KEY, PASSWORD_KEY]);
  const storedPassword = values.get(PASSWORD_KEY)?.trim() ?? "";

  let appPassword: string | null = null;
  if (storedPassword) {
    // Let decryption errors propagate: the send path reports them clearly.
    appPassword = decryptSecret(storedPassword);
  }

  return {
    address: values.get(ADDRESS_KEY)?.trim() ?? "",
    fromName: values.get(FROM_NAME_KEY)?.trim() || DEFAULT_FROM_NAME,
    appPassword,
  };
}

export function getPublicEmailSettings(): PublicEmailSettings {
  const values = readValues([ADDRESS_KEY, FROM_NAME_KEY, PASSWORD_KEY]);
  const storedPassword = values.get(PASSWORD_KEY)?.trim() ?? "";

  let passwordReadable = false;
  if (storedPassword) {
    try {
      decryptSecret(storedPassword);
      passwordReadable = true;
    } catch {
      passwordReadable = false;
    }
  }

  return {
    address: values.get(ADDRESS_KEY)?.trim() ?? "",
    fromName: values.get(FROM_NAME_KEY)?.trim() || DEFAULT_FROM_NAME,
    hasPassword: storedPassword.length > 0,
    passwordReadable,
  };
}

function upsert(key: string, value: string): void {
  db.insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    })
    .run();
}

/**
 * Saves the Gmail sender configuration. A blank `appPassword` keeps the stored
 * one, so the admin can change the address or display name without re-entering
 * the secret.
 */
export function saveEmailSettings(input: {
  address: string;
  fromName: string;
  appPassword?: string | null;
}): void {
  upsert(ADDRESS_KEY, input.address.trim());
  upsert(FROM_NAME_KEY, input.fromName.trim() || DEFAULT_FROM_NAME);

  const appPassword = input.appPassword?.trim();
  if (appPassword) {
    upsert(PASSWORD_KEY, encryptSecret(appPassword));
  }
}
