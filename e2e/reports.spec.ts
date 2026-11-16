import { expect, test } from "@playwright/test";

import { seedAssignment, seedMeter, seedReadings, seedUser } from "./helpers/db";
import { adminEmail, adminPassword } from "./helpers/env";
import { login, signOut } from "./helpers/ui";

const OWNER_ONE = "reportone";
const OWNER_TWO = "reporttwo";
const METER_ONE = "Report Boat — One";
const METER_TWO = "Report Boat — Two";

let ownerOneId = 0;

test.beforeAll(() => {
  ownerOneId = seedUser({
    email: "report-one@marina.test",
    username: OWNER_ONE,
    password: "report-pass-123",
    role: "owner",
  });
  seedUser({
    email: "report-two@marina.test",
    username: OWNER_TWO,
    password: "report-pass-123",
    role: "owner",
  });

  seedMeter({
    name: METER_ONE,
    ownerUsername: OWNER_ONE,
    powerEntityId: "sensor.shore_power_boat14_power",
    energyEntityId: "sensor.shore_power_boat14_energy",
  });
  seedMeter({
    name: METER_TWO,
    ownerUsername: OWNER_TWO,
    powerEntityId: "sensor.shore_power_boat15_power",
    energyEntityId: "sensor.shore_power_boat15_energy",
  });

  const now = Date.now();
  seedAssignment({
    meterName: METER_ONE,
    ownerUsername: OWNER_ONE,
    consumedKwh: 0,
    startedAt: now - 3_600_000,
  });
  seedAssignment({
    meterName: METER_TWO,
    ownerUsername: OWNER_TWO,
    consumedKwh: 0,
    startedAt: now - 3_600_000,
  });

  // Two samples for owner one (1.5 + 0.5 = 2.0 kWh today) and one for owner two (4.0 kWh).
  seedReadings(METER_ONE, [
    { recordedAt: now - 120_000, deltaKwh: 1.5, powerW: 1500 },
    { recordedAt: now - 60_000, deltaKwh: 0.5, powerW: 900 },
  ]);
  seedReadings(METER_TWO, [{ recordedAt: now - 30_000, deltaKwh: 4, powerW: 2000 }]);
});

test.describe.serial("reports", () => {
  async function loadDailyReport(page: import("@playwright/test").Page) {
    await page.goto("/admin/reports");
    await page.getByRole("checkbox", { name: /reportone/i }).check();
    await page.getByRole("checkbox", { name: /reporttwo/i }).check();
    await page.getByRole("button", { name: "Load data" }).click();
    await expect(page).toHaveURL(/\/admin\/reports\?/);
  }

  test("shows daily consumption for the selected users", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await loadDailyReport(page);

    const summary = page.locator("table");
    await expect(summary).toContainText(OWNER_ONE);
    await expect(summary).toContainText(METER_ONE);
    await expect(summary).toContainText("2.00 kWh");
    await expect(summary).toContainText(OWNER_TWO);
    await expect(summary).toContainText(METER_TWO);
    await expect(summary).toContainText("4.00 kWh");
    await expect(page.getByRole("link", { name: "Export CSV" })).toBeVisible();
  });

  test("exports the same numbers as CSV", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await loadDailyReport(page);

    const href = await page.getByRole("link", { name: "Export CSV" }).getAttribute("href");
    expect(href).toBeTruthy();
    const response = await page.request.get(href as string);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toContain(".csv");

    const body = await response.text();
    expect(body).toContain("user,email,meter,period,kwh,samples");
    expect(body).toMatch(
      new RegExp(`${OWNER_ONE},report-one@marina\\.test,${METER_ONE},\\d{4}-\\d{2}-\\d{2},2\\.000,2`),
    );
    expect(body).toMatch(
      new RegExp(`${OWNER_TWO},report-two@marina\\.test,${METER_TWO},\\d{4}-\\d{2}-\\d{2},4\\.000,1`),
    );
  });

  test("raw samples show one row per reading", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await page.goto("/admin/reports");
    await page.getByRole("checkbox", { name: /reportone/i }).check();
    await page.getByLabel("Detail").selectOption("raw");
    await page.getByRole("button", { name: "Load data" }).click();

    await expect(page.getByRole("columnheader", { name: "Timestamp" })).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(page.locator("table")).toContainText("1.50 kWh");
    await expect(page.locator("table")).toContainText("0.50 kWh");
  });

  test("owners cannot open the report or the CSV export", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await signOut(page);
    await login(page, OWNER_ONE, "report-pass-123");

    await page.goto("/admin/reports");
    await expect(page).toHaveURL(/\/dashboard$/);

    const response = await page.request.get(
      `/api/admin/reports/export?users=${ownerOneId}&from=2026-01-01&to=2026-01-31`,
    );
    expect(response.status()).toBe(403);
  });
});
