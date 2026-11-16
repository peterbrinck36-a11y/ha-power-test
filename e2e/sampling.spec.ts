import { expect, test } from "@playwright/test";

import {
  countReadings,
  seedAssignment,
  seedMeter,
  seedMeterState,
  seedUser,
} from "./helpers/db";
import { adminEmail, adminPassword } from "./helpers/env";

const METER = "Boat #16 — Slip E";

test.beforeAll(() => {
  seedUser({
    email: "sample-owner@marina.test",
    username: "sampleskipper",
    password: "sample-pass-123",
    role: "owner",
  });
  seedMeter({
    name: METER,
    ownerUsername: "sampleskipper",
    // 1450 W and 45678 Wh in the mock — the sampler must normalize Wh → kWh.
    powerEntityId: "sensor.shore_power_boat15_power",
    energyEntityId: "sensor.shore_power_boat15_energy",
  });
  seedAssignment({ meterName: METER, ownerUsername: "sampleskipper", consumedKwh: 0 });
  // Pretend the last stored counter was 45.000 kWh, so the next sample sees
  // 45678 Wh = 45.678 kWh and credits a 0.678 kWh delta.
  seedMeterState(METER, 45);
});

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("a manual sample stores a reading and credits the kWh delta", async ({ page }) => {
  await adminLogin(page);

  const before = countReadings(METER);
  const response = await page.request.post("/api/admin/sample");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { recorded: boolean; meters: number };
  expect(body.recorded).toBe(true);
  expect(body.meters).toBeGreaterThan(0);
  expect(countReadings(METER)).toBe(before + 1);

  // The API exposes the DB-owned total, normalized from Wh to kWh.
  const readings = await page.request.get("/api/ha/readings");
  const payload = (await readings.json()) as {
    readings: { meterName: string; energy: { kwhTotal: number | null } }[];
  };
  const reading = payload.readings.find((item) => item.meterName === METER);
  expect(reading?.energy.kwhTotal).toBeCloseTo(0.678, 3);

  // The owner sees the accumulated total and the live power.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email or username").fill("sampleskipper");
  await page.getByLabel("Password").fill("sample-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const card = page.getByRole("region").filter({ hasText: METER });
  await expect(card).toContainText("0.68 kWh");
  await expect(card).toContainText("1.45 kW");
  await expect(card).not.toContainText("waiting for sample");
});

test("an unchanged counter adds no consumption on the next sample", async ({ page }) => {
  await adminLogin(page);

  const before = countReadings(METER);
  const response = await page.request.post("/api/admin/sample");
  expect(response.status()).toBe(200);
  expect(countReadings(METER)).toBe(before + 1);

  const readings = await page.request.get("/api/ha/readings");
  const payload = (await readings.json()) as {
    readings: { meterName: string; energy: { kwhTotal: number | null } }[];
  };
  const reading = payload.readings.find((item) => item.meterName === METER);
  expect(reading?.energy.kwhTotal).toBeCloseTo(0.678, 3);
});
