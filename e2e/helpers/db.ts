import Database from "better-sqlite3";
import { hashSync } from "bcryptjs";

import { e2eDbPath } from "./env";

export type SeedUser = {
  email: string;
  username: string;
  password: string;
  role?: "admin" | "owner";
  active?: boolean;
  /** Seed a user still holding an emailed temporary password. */
  mustChangePassword?: boolean;
  /** When set, the login flow rejects the temporary password after this time. */
  tempPasswordExpiresAt?: Date | null;
};

export type SeedMeter = {
  name: string;
  ownerUsername?: string | null;
  powerEntityId: string;
  energyEntityId: string;
};

export type SeedAssignment = {
  meterName: string;
  ownerUsername?: string | null;
  /** Total already accumulated for this assignment (our DB is the source of truth). */
  consumedKwh?: number;
  startedAt?: number;
};

function open(): Database.Database {
  return new Database(e2eDbPath);
}

function meterIdByName(db: Database.Database, meterName: string): number {
  const row = db.prepare("SELECT id FROM meters WHERE name = ?").get(meterName) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`seed: meter "${meterName}" not found`);
  return row.id;
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
        `INSERT INTO users
           (email, username, password_hash, role, active, must_change_password, temp_password_expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        user.email.toLowerCase(),
        user.username,
        hashSync(user.password, 12),
        user.role ?? "owner",
        (user.active ?? true) ? 1 : 0,
        (user.mustChangePassword ?? false) ? 1 : 0,
        user.tempPasswordExpiresAt ? user.tempPasswordExpiresAt.getTime() : null,
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
        `INSERT INTO meters (name, owner_id, power_entity_id, energy_entity_id)
         VALUES (?, ?, ?, ?)`,
      )
      .run(meter.name, ownerId, meter.powerEntityId, meter.energyEntityId);
    return Number(info.lastInsertRowid);
  } finally {
    db.close();
  }
}

/**
 * Replaces the meter's ownership periods with a single open one, so tests can
 * assert a known DB-owned total without running the sampler.
 */
export function seedAssignment(assignment: SeedAssignment): void {
  const db = open();
  try {
    const meterId = meterIdByName(db, assignment.meterName);

    let ownerId: number | null = null;
    if (assignment.ownerUsername) {
      const row = db
        .prepare("SELECT id FROM users WHERE username = ?")
        .get(assignment.ownerUsername) as { id: number } | undefined;
      if (!row) throw new Error(`seedAssignment: user ${assignment.ownerUsername} not found`);
      ownerId = row.id;
    }

    db.prepare("DELETE FROM meter_assignments WHERE meter_id = ?").run(meterId);
    db.prepare(
      `INSERT INTO meter_assignments (meter_id, owner_id, started_at, ended_at, consumed_kwh)
       VALUES (?, ?, ?, NULL, ?)`,
    ).run(meterId, ownerId, assignment.startedAt ?? Date.now(), assignment.consumedKwh ?? 0);
  } finally {
    db.close();
  }
}

/**
 * Pre-seeds the sampler's stored counter so the next sampling pass produces a
 * deterministic delta (0 = "never sampled", so the first pass only baselines).
 */
export function seedMeterState(meterName: string, lastEnergyKwh: number | null): void {
  const db = open();
  try {
    const meterId = meterIdByName(db, meterName);
    db.prepare(
      `INSERT INTO meter_state (meter_id, last_energy_kwh, last_energy_available, last_sampled_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(meter_id) DO UPDATE SET
         last_energy_kwh = excluded.last_energy_kwh,
         last_energy_available = excluded.last_energy_available,
         last_sampled_at = excluded.last_sampled_at`,
    ).run(meterId, lastEnergyKwh, lastEnergyKwh === null ? 0 : 1, Date.now());
  } finally {
    db.close();
  }
}

export function countReadings(meterName: string): number {
  const db = open();
  try {
    const meterId = meterIdByName(db, meterName);
    const row = db
      .prepare("SELECT count(*) AS n FROM readings WHERE meter_id = ?")
      .get(meterId) as { n: number };
    return row.n;
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

/** Removes the stored Gmail configuration (used to test the email-failure path). */
export function clearEmailSettings(): void {
  const db = open();
  try {
    db.prepare("DELETE FROM app_settings").run();
  } finally {
    db.close();
  }
}
