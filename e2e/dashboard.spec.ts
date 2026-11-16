import { expect, test } from "@playwright/test";

import { seedMeter, seedUser } from "./helpers/db";

// Fixtures for the three dashboard scenarios (normal / kW / unavailable / empty).
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

  seedMeter({
    name: "Dash Boat #12 — Slip A",
    ownerUsername: "dashskipper",
    powerEntityId: "sensor.stue_lampe_stue_power",
    energyEntityId: "sensor.stue_lampe_stue_energy",
    kwhOffset: 5.239,
  });
  seedMeter({
    name: "Boat #14 — Slip C",
    ownerUsername: "dashskipper",
    powerEntityId: "sensor.shore_power_boat14_power",
    energyEntityId: "sensor.shore_power_boat14_energy",
  });
  seedMeter({
    name: "Boat #13 — Slip B",
    ownerUsername: "partskipper",
    powerEntityId: "sensor.shore_power_boat13_power", // unavailable in mock
    energyEntityId: "sensor.shore_power_boat13_energy",
  });

  seedUser({
    email: "wh-owner@marina.test",
    username: "whskipper",
    password: "wh-pass-123",
    role: "owner",
  });
  seedMeter({
    name: "Boat #15 — Slip D",
    ownerUsername: "whskipper",
    powerEntityId: "sensor.shore_power_boat15_power",
    energyEntityId: "sensor.shore_power_boat15_energy", // reports Wh in the mock
    kwhOffset: 0.678,
  });
});

async function openDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  await expect(page.getByText("Auto-refreshes every 10s")).toBeVisible();
}

test("owner sees live values with offset-adjusted total", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("dashskipper");
  await page.getByLabel("Password").fill("dash-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await openDashboard(page);

  const card12 = page
    .getByRole("region")
    .filter({ hasText: "Dash Boat #12 — Slip A" })
    .filter({ hasText: "302.6 W" });
  await expect(card12).toBeVisible();
  await expect(card12).toContainText("190.00 kWh"); // 195.239 − 5.239 offset, clamped
  await expect(card12).toContainText("offset −5.239 kWh");
  await expect(card12).toContainText("live");

  const card14 = page
    .getByRole("region")
    .filter({ hasText: "Boat #14 — Slip C" })
    .filter({ hasText: "4.80 kW" });
  await expect(card14).toBeVisible(); // kW normalization: 4.8 kW sensor → 4800 W → 4.80 kW
  await expect(card14).toContainText("1200.50 kWh");
});

test("unavailable power sensor shows fallback while energy stays live", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("partskipper");
  await page.getByLabel("Password").fill("part-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await openDashboard(page);

  const card13 = page.getByRole("region").filter({ hasText: "Boat #13 — Slip B" });
  await expect(card13).toBeVisible();
  await expect(card13).toContainText("partial"); // card-level chip
  await expect(card13).toContainText("unavailable"); // power chip
  await expect(card13).toContainText("88.40 kWh"); // energy still live
});

test("user without meters sees the empty state", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("emptyskipper");
  await page.getByLabel("Password").fill("empty-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await openDashboard(page);

  await expect(page.getByText("No meters assigned yet")).toBeVisible();
  await expect(page.getByText("Contact the marina admin")).toBeVisible();
});

test("Wh energy sensor is normalized to kWh before the offset", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("whskipper");
  await page.getByLabel("Password").fill("wh-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await openDashboard(page);

  const card15 = page.getByRole("region").filter({ hasText: "Boat #15 — Slip D" });
  await expect(card15).toBeVisible();
  // 45678 Wh → 45.678 kWh − 0.678 offset (not 45678 − 0.678 = 45677.32)
  await expect(card15).toContainText("45.00 kWh");
  await expect(card15).toContainText("1.45 kW");
});
