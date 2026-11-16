import { expect, test } from "@playwright/test";

import { seedAssignment, seedMeter, seedReadings, seedUser } from "./helpers/db";
import { adminEmail, adminPassword } from "./helpers/env";
import { login, signOut } from "./helpers/ui";

const OWNER = "debugskipper";
const METER = "Debug Boat — D";

let ownerId = 0;
let meterId = 0;

function localDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const today = localDateKey(new Date());

test.beforeAll(() => {
  ownerId = seedUser({
    email: "debug-owner@marina.test",
    username: OWNER,
    password: "debug-pass-123",
    role: "owner",
  });
  meterId = seedMeter({
    name: METER,
    ownerUsername: OWNER,
    powerEntityId: "sensor.shore_power_boat14_power",
    energyEntityId: "sensor.shore_power_boat14_energy",
  });
  seedAssignment({
    meterName: METER,
    ownerUsername: OWNER,
    consumedKwh: 2,
    startedAt: Date.now() - 3 * 86_400_000,
  });
  seedReadings(METER, [
    { recordedAt: Date.now() - 120_000, deltaKwh: 1.5, powerW: 1500 },
    { recordedAt: Date.now() - 60_000, deltaKwh: 0.5, powerW: 900 },
  ]);
});

async function openDebug(page: import("@playwright/test").Page) {
  await login(page, adminEmail, adminPassword);
  await page.goto(`/admin/debug?meter=${meterId}`);
  await expect(page.getByRole("heading", { name: "Debug" })).toBeVisible();
}

test.describe.serial("debug tools", () => {
  test("editing a day's kWh updates the stored readings and running total", async ({ page }) => {
    await openDebug(page);

    const dayInput = page.getByLabel(`kWh for ${today}`);
    await expect(dayInput).toHaveValue("2.000");
    await dayInput.fill("5.250");
    await page.getByRole("button", { name: "Save daily totals" }).click();

    await expect(page.getByLabel(`kWh for ${today}`)).toHaveValue("5.250");

    await page.goto("/admin/reports");
    await page.getByRole("checkbox", { name: new RegExp(OWNER, "i") }).check();
    await page.getByRole("button", { name: "Load data" }).click();
    await expect(page.locator("table")).toContainText("5.25 kWh");
  });

  test("editing the assignment date and total is reflected on the user page", async ({ page }) => {
    await openDebug(page);

    const tenDaysAgo = localDateKey(new Date(Date.now() - 10 * 86_400_000));
    await page.locator("#debug-started-at").fill(tenDaysAgo);
    await page.locator("#debug-consumed").fill("42.5");
    await page.getByRole("button", { name: "Save assignment" }).click();

    await expect(page.locator("#debug-consumed")).toHaveValue("42.500");
    await page.goto(`/admin/users/${ownerId}`);
    await expect(page.getByText("42.50 kWh combined")).toBeVisible();
  });

  test("quick actions sample now and clear readings", async ({ page }) => {
    await openDebug(page);

    await page.getByRole("button", { name: "Sample now" }).click();
    await expect(page.getByRole("heading", { name: "Debug" })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Clear readings" }).click();
    await expect(page.getByText("No readings stored for this meter yet.")).toBeVisible();
    await expect(page.getByLabel(`kWh for ${today}`)).toHaveValue("0.000");
    await expect(page.locator("#debug-consumed")).toHaveValue("0.000");
  });

  test("owners cannot open the debug page", async ({ page }) => {
    await login(page, OWNER, "debug-pass-123");
    await page.goto("/admin/debug");
    await expect(page).toHaveURL(/\/dashboard$/);
    await signOut(page);
  });
});
