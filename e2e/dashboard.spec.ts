import { expect, test } from "@playwright/test";

import { seedAssignment, seedMeter, seedMeterState, seedUser } from "./helpers/db";

// Fixtures for the dashboard scenarios. Totals come from our own DB (the
// meter's open assignment), not from the HA energy counter.
test.beforeAll(() => {
  seedUser({
    email: "dash-owner@marina.test",
    username: "dashskipper",
    password: "dash-pass-123",
    role: "owner",
  });
  seedUser({
    email: "partial-owner@marina.test",
    username: "partskipper",
    password: "part-pass-123",
    role: "owner",
  });
  seedUser({
    email: "empty-owner@marina.test",
    username: "emptyskipper",
    password: "empty-pass-123",
    role: "owner",
  });
  seedUser({
    email: "fresh-owner@marina.test",
    username: "freshskipper",
    password: "fresh-pass-123",
    role: "owner",
  });

  seedMeter({
    name: "Dash Boat #12 — Slip A",
    ownerUsername: "dashskipper",
    powerEntityId: "sensor.stue_lampe_stue_power",
    energyEntityId: "sensor.stue_lampe_stue_energy",
  });
  seedAssignment({ meterName: "Dash Boat #12 — Slip A", ownerUsername: "dashskipper", consumedKwh: 190 });

  seedMeter({
    name: "Boat #14 — Slip C",
    ownerUsername: "dashskipper",
    powerEntityId: "sensor.shore_power_boat14_power",
    energyEntityId: "sensor.shore_power_boat14_energy",
  });
  seedAssignment({ meterName: "Boat #14 — Slip C", ownerUsername: "dashskipper", consumedKwh: 1200.5 });

  seedMeter({
    name: "Boat #13 — Slip B",
    ownerUsername: "partskipper",
    powerEntityId: "sensor.shore_power_boat13_power", // unavailable in mock
    energyEntityId: "sensor.shore_power_boat13_energy",
  });
  seedAssignment({ meterName: "Boat #13 — Slip B", ownerUsername: "partskipper", consumedKwh: 88.4 });
  seedMeterState("Boat #13 — Slip B", 88.4); // last sample had a usable energy reading

  // Fresh assignment: total is 0 and no sample has happened yet.
  seedMeter({
    name: "Boat #17 — Slip F",
    ownerUsername: "freshskipper",
    powerEntityId: "sensor.shore_power_boat15_power",
    energyEntityId: "sensor.shore_power_boat15_energy",
  });
  seedAssignment({ meterName: "Boat #17 — Slip F", ownerUsername: "freshskipper", consumedKwh: 0 });
});

async function loginAs(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Auto-refreshes every 10s")).toBeVisible();
}

test("owner sees live power plus the DB-owned totals", async ({ page }) => {
  await loginAs(page, "dashskipper", "dash-pass-123");

  const card12 = page
    .getByRole("region")
    .filter({ hasText: "Dash Boat #12 — Slip A" })
    .filter({ hasText: "302.6 W" });
  await expect(card12).toBeVisible();
  await expect(card12).toContainText("190.00 kWh"); // from meter_assignments, not HA
  await expect(card12).toContainText("Since ");
  await expect(card12).not.toContainText("offset");

  const card14 = page
    .getByRole("region")
    .filter({ hasText: "Boat #14 — Slip C" })
    .filter({ hasText: "4.80 kW" });
  await expect(card14).toBeVisible(); // kW normalization: 4.8 kW sensor → 4800 W → 4.80 kW
  await expect(card14).toContainText("1200.50 kWh");
});

test("unavailable power sensor shows a partial card while the total stays known", async ({
  page,
}) => {
  await loginAs(page, "partskipper", "part-pass-123");

  const card13 = page.getByRole("region").filter({ hasText: "Boat #13 — Slip B" });
  await expect(card13).toBeVisible();
  await expect(card13).toContainText("partial");
  await expect(card13).toContainText("unavailable");
  await expect(card13).toContainText("88.40 kWh"); // still the DB total
});

test("a fresh assignment shows 0.00 kWh and waits for the first sample", async ({ page }) => {
  await loginAs(page, "freshskipper", "fresh-pass-123");

  const card = page.getByRole("region").filter({ hasText: "Boat #17 — Slip F" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("0.00 kWh");
  await expect(card).toContainText("waiting for sample");
  await expect(card).toContainText("Since ");
});

test("user without meters sees the empty state", async ({ page }) => {
  await loginAs(page, "emptyskipper", "empty-pass-123");

  await expect(page.getByText("No meters assigned yet")).toBeVisible();
  await expect(page.getByText("Contact the marina admin")).toBeVisible();
});
