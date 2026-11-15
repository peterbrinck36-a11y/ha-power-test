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
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });

// Apply pending Drizzle migrations (synchronous with better-sqlite3).
// In Docker the drizzle/ folder is copied into the standalone bundle via
// outputFileTracingIncludes, so process.cwd()/drizzle resolves at runtime.
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

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
