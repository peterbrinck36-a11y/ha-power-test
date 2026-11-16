import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "owner"] }).notNull().default("owner"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  /** True until the user replaces their emailed temporary password. */
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(false),
  /** Temporary-password expiry; null once the user sets a real password. */
  tempPasswordExpiresAt: integer("temp_password_expires_at", { mode: "timestamp_ms" }),
  /** Bumped on every password change/reset; stale session JWTs stop validating. */
  sessionVersion: integer("session_version").notNull().default(0),
  ...timestamps,
});

export const meters = sqliteTable("meters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Friendly name / slip label shown to the boat owner, e.g. "Boat #12 — Slip A". */
  name: text("name").notNull(),
  /** Assigned boat owner. Null = unassigned. One meter per user in practice. */
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
  /** HA entity delivering live power (W, or kW — normalized server-side). */
  powerEntityId: text("power_entity_id").notNull(),
  /** HA entity delivering total energy (Wh/kWh/MWh — normalized server-side). */
  energyEntityId: text("energy_entity_id").notNull(),
  ...timestamps,
});

/**
 * Ownership periods. Every owner change closes the current open row and opens
 * a new one with `consumed_kwh = 0`, which is what makes an assignment reset
 * the consumption. The open row (ended_at IS NULL) is the meter's current
 * total; closed rows are the audit trail monthly reports run on.
 */
export const meterAssignments = sqliteTable(
  "meter_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    meterId: integer("meter_id")
      .notNull()
      .references(() => meters.id, { onDelete: "cascade" }),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    /** kWh accumulated from our own samples since `started_at`. */
    consumedKwh: real("consumed_kwh").notNull().default(0),
  },
  (table) => [
    index("meter_assignments_meter_idx").on(table.meterId, table.endedAt),
    // At most one open assignment per meter — the sampler's accounting invariant.
    uniqueIndex("meter_assignments_open_unique")
      .on(table.meterId)
      .where(sql`ended_at is null`),
  ],
);

/**
 * App-owned sample history (append-only). The sampler inserts one row per
 * meter per tick; `delta_kwh` is the consumption attributed to that interval
 * and is the source for monthly reports.
 */
export const readings = sqliteTable(
  "readings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    meterId: integer("meter_id")
      .notNull()
      .references(() => meters.id, { onDelete: "cascade" }),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
    powerW: real("power_w"),
    energyKwh: real("energy_kwh"),
    /** max(0, current − previous) — never negative, counter resets are ignored. */
    deltaKwh: real("delta_kwh"),
    powerAvailable: integer("power_available", { mode: "boolean" }).notNull(),
    energyAvailable: integer("energy_available", { mode: "boolean" }).notNull(),
  },
  (table) => [index("readings_meter_recorded_idx").on(table.meterId, table.recordedAt)],
);

/** Per-meter sampler bookkeeping: the previous energy value used for deltas. */
export const meterState = sqliteTable("meter_state", {
  meterId: integer("meter_id")
    .primaryKey()
    .references(() => meters.id, { onDelete: "cascade" }),
  lastEnergyKwh: real("last_energy_kwh"),
  lastEnergyAvailable: integer("last_energy_available", { mode: "boolean" })
    .notNull()
    .default(false),
  lastSampledAt: integer("last_sampled_at", { mode: "timestamp_ms" }),
});

/**
 * Monthly consumption tiers ("categories"). Ordered by `min_kwh`; the category
 * a user is in is the highest tier whose threshold their month-to-date total has
 * reached. Thresholds are unique so the ordering is unambiguous; the top tier is
 * open-ended. Nothing is seeded — with no rows the owner-facing card is hidden.
 */
export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    /** Lower bound of the tier in kWh (inclusive). */
    minKwh: real("min_kwh").notNull(),
    /** Palette key from `src/lib/category-colors.ts` (not a free-form class name). */
    color: text("color").notNull().default("slate"),
    ...timestamps,
  },
  (table) => [uniqueIndex("categories_min_kwh_unique").on(table.minKwh)],
);

/**
 * Small key/value store for app-wide configuration (currently the Gmail
 * sender). Values are never exposed to the browser except through explicit
 * public projections.
 */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Meter = typeof meters.$inferSelect;
export type NewMeter = typeof meters.$inferInsert;
export type MeterAssignment = typeof meterAssignments.$inferSelect;
export type NewMeterAssignment = typeof meterAssignments.$inferInsert;
export type Reading = typeof readings.$inferSelect;
export type NewReading = typeof readings.$inferInsert;
export type MeterState = typeof meterState.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
