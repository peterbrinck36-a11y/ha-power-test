import { expect, test } from "@playwright/test";

import {
  clearCategories,
  seedAssignment,
  seedMeter,
  seedReadings,
  seedUser,
} from "./helpers/db";
import { adminEmail, adminPassword } from "./helpers/env";
import { login } from "./helpers/ui";

const NOW = Date.now();

// Two owners whose live sampler rows are known, so the month-to-date total and
// the tier arithmetic are deterministic.
test.beforeAll(() => {
  clearCategories();

  seedUser({
    email: "cat-owner@marina.test",
    username: "catowner",
    password: "cat-pass-123",
    role: "owner",
  });
  seedUser({
    email: "cat-heavy@marina.test",
    username: "catheavy",
    password: "heavy-pass-123",
    role: "owner",
  });

  seedMeter({
    name: "Cat Boat — Slip 1",
    ownerUsername: "catowner",
    powerEntityId: "sensor.shore_power_boat15_power",
    energyEntityId: "sensor.shore_power_boat15_energy",
  });
  seedAssignment({
    meterName: "Cat Boat — Slip 1",
    ownerUsername: "catowner",
    startedAt: NOW - 120_000,
    consumedKwh: 40,
  });
  seedReadings("Cat Boat — Slip 1", [{ deltaKwh: 30 }, { deltaKwh: 10 }]);

  seedMeter({
    name: "Heavy Boat — Slip 2",
    ownerUsername: "catheavy",
    powerEntityId: "sensor.shore_power_boat14_power",
    energyEntityId: "sensor.shore_power_boat14_energy",
  });
  seedAssignment({
    meterName: "Heavy Boat — Slip 2",
    ownerUsername: "catheavy",
    startedAt: NOW - 120_000,
    consumedKwh: 200,
  });
  seedReadings("Heavy Boat — Slip 2", [{ deltaKwh: 120 }, { deltaKwh: 80 }]);
});

test.afterAll(() => {
  clearCategories();
});

test.describe.serial("consumption categories", () => {
  test("admin creates tiers and the table explains their ranges", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/categories");
    await expect(page.getByText("No categories yet")).toBeVisible();

    // First tier defaults to 0 so everyone can be ranked from the start.
    await page.getByRole("button", { name: "New category" }).click();
    await expect(page.locator("#category-min-kwh")).toHaveValue("0");
    await page.locator("#category-name").fill("Bronze");
    await page.locator("#category-color").selectOption("amber");
    await page.getByRole("button", { name: "Create category" }).click();
    await expect(page.locator("#category-name")).toHaveCount(0);

    let bronze = page.getByRole("row").filter({ hasText: "Bronze" });
    await expect(bronze).toContainText("0 kWh");
    await expect(bronze).toContainText("0 kWh and above");

    // Next tier pre-fills a round step above the current top threshold.
    await page.getByRole("button", { name: "New category" }).click();
    await expect(page.locator("#category-min-kwh")).toHaveValue("100");
    await page.locator("#category-name").fill("Silver");
    await page.locator("#category-min-kwh").fill("150");
    await page.locator("#category-color").selectOption("zinc");
    await page.getByRole("button", { name: "Create category" }).click();
    await expect(page.locator("#category-name")).toHaveCount(0);

    bronze = page.getByRole("row").filter({ hasText: "Bronze" });
    await expect(bronze).toContainText("0 – 150 kWh");

    // Thresholds are unique — a duplicate is rejected without closing the form.
    await page.getByRole("button", { name: "New category" }).click();
    await page.locator("#category-name").fill("Gold");
    await page.locator("#category-min-kwh").fill("150");
    await page.getByRole("button", { name: "Create category" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(
      '"Silver" already starts at 150 kWh',
    );
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "New category" }).click();
    await page.locator("#category-name").fill("Gold");
    await page.locator("#category-min-kwh").fill("300");
    await page.locator("#category-color").selectOption("yellow");
    await page.getByRole("button", { name: "Create category" }).click();
    await expect(page.locator("#category-name")).toHaveCount(0);

    const gold = page.getByRole("row").filter({ hasText: "Gold" });
    await expect(gold).toContainText("300 kWh");
    await expect(gold).toContainText("300 kWh and above");
  });

  test("owner sees the month total, current tier and distance to the next", async ({
    page,
  }) => {
    await login(page, "catowner", "cat-pass-123");
    await expect(page).toHaveURL(/\/dashboard$/);

    const card = page.getByRole("region", { name: "Monthly category" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("This month ·");
    await expect(card).toContainText("40.00");
    await expect(card).toContainText("Bronze");
    await expect(card).toContainText("110.00 kWh to Silver");
    await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "27");
  });

  test("a higher total moves the owner into the next tier", async ({ page }) => {
    await login(page, "catheavy", "heavy-pass-123");
    await expect(page).toHaveURL(/\/dashboard$/);

    const card = page.getByRole("region", { name: "Monthly category" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("200.00");
    await expect(card).toContainText("Silver");
    await expect(card).toContainText("100.00 kWh to Gold");
    await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
  });

  test("admin can delete a tier", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await page.goto("/admin/categories");

    const gold = page.getByRole("row").filter({ hasText: "Gold" });
    await expect(gold).toBeVisible();

    page.once("dialog", (dialog) => void dialog.accept());
    await gold.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("row").filter({ hasText: "Gold" })).toHaveCount(0);
  });

  test("the category card stays hidden when no tiers are configured", async ({ page }) => {
    clearCategories();

    await login(page, "catowner", "cat-pass-123");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("region").filter({ hasText: "Cat Boat" })).toBeVisible();

    await expect(
      page.getByRole("region", { name: "Monthly category" }),
    ).toHaveCount(0);
  });
});
