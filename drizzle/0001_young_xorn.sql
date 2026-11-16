CREATE TABLE `meter_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meter_id` integer NOT NULL,
	`owner_id` integer,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`consumed_kwh` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`meter_id`) REFERENCES `meters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `meter_assignments_meter_idx` ON `meter_assignments` (`meter_id`,`ended_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `meter_assignments_open_unique` ON `meter_assignments` (`meter_id`) WHERE ended_at is null;--> statement-breakpoint
CREATE TABLE `meter_state` (
	`meter_id` integer PRIMARY KEY NOT NULL,
	`last_energy_kwh` real,
	`last_energy_available` integer DEFAULT false NOT NULL,
	`last_sampled_at` integer,
	FOREIGN KEY (`meter_id`) REFERENCES `meters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `readings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meter_id` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`power_w` real,
	`energy_kwh` real,
	`delta_kwh` real,
	`power_available` integer NOT NULL,
	`energy_available` integer NOT NULL,
	FOREIGN KEY (`meter_id`) REFERENCES `meters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `readings_meter_recorded_idx` ON `readings` (`meter_id`,`recorded_at`);--> statement-breakpoint
ALTER TABLE `meters` DROP COLUMN `kwh_offset`;