import { expect, test } from "@playwright/test";

import { seedMeter, seedUser } from "./helpers/db";
import { adminEmail, adminPassword } from "./helpers/env";
import { signOut } from "./helpers/ui";

test.beforeAll(() => {
  seedUser({
    email: "ui-owner@marina.test",
    username: "uiskipper",
    password: "ui-pass-123",
    role: "owner",
  });
  seedMeter({
    name: "Boat #12 — Slip A",
    ownerUsername: "uiskipper",
    powerEntityId: "sensor.stue_lampe_stue_power",
    energyEntityId: "sensor.stue_lampe_stue_energy",
  });
});

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function openEditDialog(page: import("@playwright/test").Page, username: string) {
  const row = page.getByRole("row").filter({ hasText: username });
  await row.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test("admin creates a user via the dialog; the account can log in", async ({ page }) => {
  await adminLogin(page);
  await page.getByRole("link", { name: "Users" }).click();

  await page.getByRole("button", { name: "New user" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#user-email").fill("new-owner@marina.test");
  await dialog.locator("#user-username").fill("newskipper");
  await dialog.locator("#user-password").fill("new-pass-123");
  await dialog.getByRole("button", { name: "Create user" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole("row").filter({ hasText: "newskipper" });
  await expect(row).toBeVisible();

  // The new account can actually sign in.
  await signOut(page);
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("newskipper");
  await page.getByLabel("Password").fill("new-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("No meters assigned yet")).toBeVisible();
  await signOut(page);
});

test("admin password reset invalidates the old password", async ({ page }) => {
  await adminLogin(page);
  await page.getByRole("link", { name: "Users" }).click();

  const dialog = await openEditDialog(page, "newskipper");
  await dialog.locator("#user-password").fill("reset-pass-456");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();

  await signOut(page);

  // Old password now fails.
  // React 19 resets the form after the failed attempt, so start from a fresh page.
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("newskipper");
  await page.getByLabel("Password").fill("new-pass-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "Invalid email/username or password.",
  );

  // New password works.
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("newskipper");
  await page.getByLabel("Password").fill("reset-pass-456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await signOut(page);
});

test("admin creates a meter via the sensor picker; owner sees it on the dashboard", async ({ page }) => {
  await adminLogin(page);
  await page.getByRole("link", { name: "Meters" }).click();

  await page.getByRole("button", { name: "New meter" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#meter-name").fill("E2E Boat 99 — Slip Z");

  const ownerValue = await dialog
    .locator("#meter-owner option")
    .filter({ hasText: "newskipper" })
    .getAttribute("value");
  await dialog.locator("#meter-owner").selectOption(ownerValue ?? "");

  // SensorPicker: type a query, pick from the searchable dropdown.
  await dialog.locator("#powerEntityId").fill("kontor");
  await dialog.locator("ul button").filter({ hasText: "Power" }).first().click();
  await expect(dialog.locator("#powerEntityId")).toHaveValue(
    "sensor.stue_lampe_stue_power",
  );

  await dialog.locator("#energyEntityId").fill("kontor");
  await dialog.locator("ul button").filter({ hasText: "Energy" }).first().click();
  await expect(dialog.locator("#energyEntityId")).toHaveValue(
    "sensor.stue_lampe_stue_energy",
  );

  await dialog.locator("#meter-offset").fill("1.5");
  await dialog.getByRole("button", { name: "Create meter" }).click();
  await expect(dialog).toBeHidden();

  const meterRow = page.getByRole("row").filter({ hasText: "E2E Boat 99" });
  await expect(meterRow).toBeVisible();

  // The assigned owner now sees the meter with offset-adjusted values.
  await signOut(page);
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("newskipper");
  await page.getByLabel("Password").fill("reset-pass-456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const card = page.getByRole("region").filter({ hasText: "E2E Boat 99" });
  await expect(card).toContainText("302.6 W");
  await expect(card).toContainText("193.74 kWh"); // 195.239 − 1.5, clamped
  await expect(card).toContainText("offset −1.5 kWh");
  await signOut(page);
});

test("admin cannot disable their own account", async ({ page }) => {
  await adminLogin(page);
  await page.getByRole("link", { name: "Users" }).click();

  const dialog = await openEditDialog(page, "admin");
  await dialog.locator("#user-active").uncheck();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "You cannot disable your own account.",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("admin disables a user; login is blocked", async ({ page }) => {
  await adminLogin(page);
  await page.getByRole("link", { name: "Users" }).click();

  const dialog = await openEditDialog(page, "newskipper");
  await dialog.locator("#user-active").uncheck();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();

  await signOut(page);
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("newskipper");
  await page.getByLabel("Password").fill("reset-pass-456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("This account is disabled.");
});
