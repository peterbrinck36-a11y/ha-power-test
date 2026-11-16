import "server-only";

import fs from "node:fs";
import path from "node:path";

import { sql } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

const dbPath = path.resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH ?? "./data/marina.db");

function describeOpenError(err: unknown): string {
  const uid = typeof process.getuid === "function" ? `uid ${process.getuid()}` : "the container user";
  return (
    `[db] Cannot open SQLite database at ${dbPath}: ` +
    `${err instanceof Error ? err.message : String(err)}. ` +
    `In Docker, /app/data is a bind mount — make sure the HOST directory exists and is ` +
    `writable by ${uid} (the container's non-root user), e.g. on the host: ` +
    `mkdir -p <data-dir> && chown -R 1000:1000 <data-dir>.`
  );
}

try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (err) {
  throw new Error(describeOpenError(err));
}

function createSqlite(): Database.Database {
  try {
    return new Database(dbPath);
  } catch (err) {
    throw new Error(describeOpenError(err));
  }
}

export const sqlite = createSqlite();
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });

// Apply pending Drizzle migrations (synchronous with better-sqlite3).
// In Docker the drizzle/ folder is copied into the standalone bundle via
// outputFileTracingIncludes, so process.cwd()/drizzle resolves at runtime.
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

/**
 * Ensures every meter that already has an owner has an open assignment period.
 * This is what "everyone starts at 0" means on the first boot after the
 * app-owned-history migration: existing meters get a fresh period at
 * `consumed_kwh = 0`, and the sampler starts counting from there.
 *
 * Atomic "insert if none open" — safe with parallel build workers and multiple
 * processes (the partial unique index is the final backstop).
 */
function backfillOpenAssignments(): void {
  db.run(sql`
    insert into meter_assignments (meter_id, owner_id, started_at, ended_at, consumed_kwh)
    select m.id, m.owner_id, unixepoch() * 1000, null, 0
    from meters m
    where m.owner_id is not null
      and not exists (
        select 1 from meter_assignments a
        where a.meter_id = m.id and a.ended_at is null
      )
  `);
}

backfillOpenAssignments();

/**
 * Seeds the initial admin from ADMIN_EMAIL / ADMIN_PASSWORD when no admin
 * exists yet. Runs once at module init (first db import of the process).
 */
function seedAdminIfMissing(): void {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn("[db] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin seed");
    return;
  }

  // Atomic "insert if no admin exists" — race-free even when parallel Next
  // build workers (or multiple processes) initialize this module at once.
  const username = email.split("@")[0] ?? email;
  const result = db.run(sql`
    insert into users (email, username, password_hash, role, active)
    select ${email}, ${username}, ${hashSync(password, 12)}, 'admin', 1
    where not exists (select 1 from users where role = 'admin')
  `);

  if (result.changes > 0) {
    console.log(`[db] seeded initial admin: ${email}`);
  }
}

seedAdminIfMissing();
