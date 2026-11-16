import { expect, test } from "@playwright/test";

import { seedAssignment, seedMeter, seedUser } from "./helpers/db";
import { adminEmail, adminPassword } from "./helpers/env";
import { login } from "./helpers/ui";

const OWNER = "meterowner";
const FIRST_METER = "Owner Boat — A";
const SPARE_METER = "Spare Dock — B";

test.beforeAll(() => {
  seedUser({
    email: "meter-owner@marina.test",
    username: OWNER,
    password: "meter-pass-123",
    role: "owner",
  });
  seedMeter({
    name: FIRST_METER,
    ownerUsername: OWNER,
    powerEntityId: "sensor.shore_power_boat14_power",
    energyEntityId: "sensor.shore_power_boat14_energy",
  });
  seedAssignment({
    meterName: FIRST_METER,
    ownerUsername: OWNER,
    consumedKwh: 12.5,
    startedAt: Date.now() - 3_600_000,
  });
  seedMeter({
    name: SPARE_METER,
    ownerUsername: null,
    powerEntityId: "sensor.shore_power_boat15_power",
    energyEntityId: "sensor.shore_power_boat15_energy",
  });
});

test.describe.serial("user detail meters", () => {
  test("clicking a user shows every meter connected to them", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole("link", { name: "Users" }).click();
    await page.getByRole("link", { name: OWNER }).click();
    await expect(page).toHaveURL(/\/admin\/users\/\d+$/);

    await expect(page.getByRole("heading", { name: OWNER })).toBeVisible();
    await expect(page.getByText("1 meter · 12.50 kWh combined")).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: FIRST_METER });
    await expect(row).toBeVisible();
    await expect(row).toContainText("12.50 kWh");
    await expect(row).toContainText("sensor.shore_power_boat14_power");

    await expect(page.getByText("Assign an existing meter")).toBeVisible();
  });

  test("an unassigned meter can be attached to the user from their page", async ({
    page,
  }) => {
    await login(page, adminEmail, adminPassword);
    await page.goto("/admin/users");
    await page.getByRole("link", { name: OWNER }).click();

    const option = page.locator("#assign-meter option").filter({ hasText: SPARE_METER });
    const value = await option.getAttribute("value");
    await page.locator("#assign-meter").selectOption(value!);
    await page.getByRole("button", { name: "Assign meter" }).click();

    await expect(page.getByRole("row").filter({ hasText: SPARE_METER })).toBeVisible();
    await expect(page.getByText("2 meters · 12.50 kWh combined")).toBeVisible();
    await expect(page.getByText("Every meter is assigned.")).toBeVisible();
  });

  test("new meter dialog is pre-filled with the user as owner", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await page.goto("/admin/users");
    await page.getByRole("link", { name: OWNER }).click();
    await expect(page).toHaveURL(/\/admin\/users\/\d+$/);

    const userId = page.url().match(/\/admin\/users\/(\d+)$/)?.[1];
    expect(userId).toBeTruthy();

    await page.getByRole("button", { name: "New meter" }).click();
    await expect(page.locator("#meter-owner")).toHaveValue(userId!);
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("unassigning returns the meter to the unowned pool", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await page.goto("/admin/users");
    await page.getByRole("link", { name: OWNER }).click();

    const row = page.getByRole("row").filter({ hasText: SPARE_METER });
    await row.getByRole("button", { name: "Unassign" }).click();

    await expect(page.getByRole("row").filter({ hasText: SPARE_METER })).toHaveCount(0);
    await expect(page.getByText("1 meter · 12.50 kWh combined")).toBeVisible();

    await page.getByRole("link", { name: "Meters" }).click();
    const meterRow = page.getByRole("row").filter({ hasText: SPARE_METER });
    await expect(meterRow).toContainText("unassigned");
  });
});
