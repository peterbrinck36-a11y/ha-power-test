import { expect, test } from "@playwright/test";

import { seedUser } from "./helpers/db";

test("health endpoint reports ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { ok: boolean };
  expect(body.ok).toBe(true);
});

test("readings API is 401 without a session", async ({ request }) => {
  const res = await request.get("/api/ha/readings");
  expect(res.status()).toBe(401);
});

test("owners get their readings but not the admin sensor feed", async ({ page }) => {
  seedUser({
    email: "api-owner@marina.test",
    username: "apiowner",
    password: "api-pass-123",
    role: "owner",
  });

  await page.goto("/login");
  await page.getByLabel("Email or username").fill("apiowner");
  await page.getByLabel("Password").fill("api-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Owner-scoped readings (empty list — no meters assigned to this user).
  const readings = await page.request.get("/api/ha/readings");
  expect(readings.status()).toBe(200);
  const readingsBody = (await readings.json()) as { readings: unknown[] };
  expect(readingsBody.readings).toEqual([]);

  // Admin-only sensor picker feed is forbidden for owners.
  const sensors = await page.request.get("/api/admin/ha-sensors");
  expect(sensors.status()).toBe(403);
});
