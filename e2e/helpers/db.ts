import Database from "better-sqlite3";
import { hashSync } from "bcryptjs";

import { e2eDbPath } from "./env";

export type SeedUser = {
  email: string;
  username: string;
  password: string;
  role?: "admin" | "owner";
  active?: boolean;
};

export type SeedMeter = {
  name: string;
  ownerUsername?: string | null;
  powerEntityId: string;
  energyEntityId: string;
  kwhOffset?: number;
};

function open(): Database.Database {
  return new Database(e2eDbPath);
}

/** Direct DB seeding — the server has already migrated this DB at boot. Idempotent. */
export function seedUser(user: SeedUser): number {
  const db = open();
  try {
    const existing = db
      .prepare("SELECT id FROM users WHERE lower(username) = lower(?)")
      .get(user.username) as { id: number } | undefined;
    if (existing) return existing.id; // worker restarts re-run beforeAll hooks

    const info = db
      .prepare(
        `INSERT INTO users (email, username, password_hash, role, active)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        user.email.toLowerCase(),
        user.username,
        hashSync(user.password, 12),
        user.role ?? "owner",
        user.active ?? true ? 1 : 0,
      );
    return Number(info.lastInsertRowid);
  } finally {
    db.close();
  }
}

export function seedMeter(meter: SeedMeter): number {
  const db = open();
  try {
    const existing = db
      .prepare("SELECT id FROM meters WHERE name = ?")
      .get(meter.name) as { id: number } | undefined;
    if (existing) return existing.id;

    let ownerId: number | null = null;
    if (meter.ownerUsername) {
      const row = db
        .prepare("SELECT id FROM users WHERE username = ?")
        .get(meter.ownerUsername) as { id: number } | undefined;
      if (!row) throw new Error(`seedMeter: user ${meter.ownerUsername} not found`);
      ownerId = row.id;
    }
    const info = db
      .prepare(
        `INSERT INTO meters (name, owner_id, power_entity_id, energy_entity_id, kwh_offset)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        meter.name,
        ownerId,
        meter.powerEntityId,
        meter.energyEntityId,
        meter.kwhOffset ?? 0,
      );
    return Number(info.lastInsertRowid);
  } finally {
    db.close();
  }
}

export function setLastAdminPassword(email: string, newPassword: string): void {
  const db = open();
  try {
    db.prepare("UPDATE users SET password_hash = ? WHERE email = ?")
      .run(hashSync(newPassword, 12), email.toLowerCase());
  } finally {
    db.close();
  }
}
