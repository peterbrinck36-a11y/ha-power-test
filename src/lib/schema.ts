import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  /** HA entity delivering total energy (kWh). */
  energyEntityId: text("energy_entity_id").notNull(),
  /** Subtracted from the total reading (clamped at 0) to zero it for a new tenant. */
  kwhOffset: real("kwh_offset").notNull().default(0),
  ...timestamps,
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Meter = typeof meters.$inferSelect;
export type NewMeter = typeof meters.$inferInsert;
