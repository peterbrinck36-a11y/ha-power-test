import { expect, test } from "@playwright/test";

import { seedUser } from "./helpers/db";
import { adminEmail, adminPassword } from "./helpers/env";
import { login, signOut } from "./helpers/ui";

test.beforeAll(() => {
  seedUser({
    email: "auth-owner@marina.test",
    username: "authowner",
    password: "auth-pass-123",
    role: "owner",
  });
  seedUser({
    email: "auth-disabled@marina.test",
    username: "authdisabled",
    password: "auth-pass-456",
    role: "owner",
    active: false,
  });
});

test("shows an error for wrong credentials", async ({ page }) => {
  await login(page, adminEmail, "definitely-wrong");
  // p[role=alert] — Next.js's route announcer also uses role="alert".
  await expect(page.locator("p[role=alert]")).toContainText(
    "Invalid email/username or password.",
  );
  await expect(page).toHaveURL(/\/login$/);
});

test("admin signs in and lands on /admin", async ({ page }) => {
  await login(page, adminEmail, adminPassword);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("owner signs in and lands on /dashboard", async ({ page }) => {
  await login(page, "authowner", "auth-pass-123");
  await expect(page).toHaveURL(/\/dashboard$/);
  // Phase 3 replaced the stub: the page shows the polling status line.
  await expect(page.getByText("Auto-refreshes every 10s")).toBeVisible();
  await signOut(page);
});

test("disabled owner cannot sign in", async ({ page }) => {
  await login(page, "authdisabled", "auth-pass-456");
  await expect(page.locator("p[role=alert]")).toContainText("This account is disabled.");
});

test("signed-out users are redirected from /dashboard to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("owners are bounced from /admin to /dashboard", async ({ page }) => {
  await login(page, "authowner", "auth-pass-123");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
  await signOut(page);
});
