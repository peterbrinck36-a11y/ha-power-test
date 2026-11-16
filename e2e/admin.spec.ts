import { expect, test } from "@playwright/test";

import { clearEmailSettings, seedAssignment, seedMeter, seedUser } from "./helpers/db";
import { adminEmail, adminPassword } from "./helpers/env";
import { signOut } from "./helpers/ui";

test.beforeAll(() => {
  // No Gmail config in this spec: user creation falls back to showing the
  // temporary password once, which is exactly what the first test exercises.
  clearEmailSettings();

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
  seedAssignment({ meterName: "Boat #12 — Slip A", ownerUsername: "uiskipper", consumedKwh: 42.5 });

  // Seeded only so the reassignment reset can be asserted below.
  seedMeter({
    name: "Reset Boat — Slip R",
    ownerUsername: "uiskipper",
    powerEntityId: "sensor.stue_lampe_stue_power",
    energyEntityId: "sensor.stue_lampe_stue_energy",
  });
  seedAssignment({
    meterName: "Reset Boat — Slip R",
    ownerUsername: "uiskipper",
    consumedKwh: 42.5,
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
  await dialog.getByRole("button", { name: "Create user" }).click();

  // Email is not configured, so the account is created anyway and the dialog
  // reveals the generated temporary password exactly once.
  await expect(dialog.getByText("invitation email could not be sent")).toBeVisible();
  const temporaryPassword = (await dialog.locator("[data-temp-password]").innerText()).trim();
  expect(temporaryPassword).toHaveLength(16);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole("row").filter({ hasText: "newskipper" });
  await expect(row).toBeVisible();

  // The new account can sign in, but must choose its own password first.
  await signOut(page);
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("newskipper");
  await page.getByLabel("Password").fill(temporaryPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account\/password$/);

  await page.locator("#new-password").fill("new-pass-1234");
  await page.locator("#confirm-password").fill("new-pass-1234");
  await page.getByRole("button", { name: "Save password and continue" }).click();
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
  await page.getByLabel("Password").fill("new-pass-1234");
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

test("admin creates a meter via the sensor picker; the owner starts at 0 kWh", async ({ page }) => {
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

  await dialog.getByRole("button", { name: "Create meter" }).click();
  await expect(dialog).toBeHidden();

  const meterRow = page.getByRole("row").filter({ hasText: "E2E Boat 99" });
  await expect(meterRow).toBeVisible();
  await expect(meterRow).toContainText("0.00 kWh"); // fresh assignment

  // The assigned owner sees live power and a 0 total until the sampler runs.
  await signOut(page);
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("newskipper");
  await page.getByLabel("Password").fill("reset-pass-456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const card = page.getByRole("region").filter({ hasText: "E2E Boat 99" });
  await expect(card).toContainText("302.6 W");
  await expect(card).toContainText("0.00 kWh");
  await expect(card).toContainText("waiting for sample");
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

test("reassigning a meter resets the new owner's total to 0", async ({ page }) => {
  await adminLogin(page);
  await page.getByRole("link", { name: "Meters" }).click();

  const row = page.getByRole("row").filter({ hasText: "Reset Boat" });
  await expect(row).toContainText("42.50 kWh");
  await row.getByRole("button", { name: "Edit" }).click();

  const dialog = page.getByRole("dialog");
  const nextOwner = await dialog
    .locator("#meter-owner option")
    .filter({ hasText: "newskipper" })
    .getAttribute("value");
  await dialog.locator("#meter-owner").selectOption(nextOwner ?? "");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();

  // The meter now belongs to newskipper and its period restarted at 0.
  await expect(
    page.getByRole("row").filter({ hasText: "Reset Boat" }),
  ).toContainText("0.00 kWh");

  await signOut(page);
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("newskipper");
  await page.getByLabel("Password").fill("reset-pass-456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const card = page.getByRole("region").filter({ hasText: "Reset Boat" });
  await expect(card).toContainText("0.00 kWh");
  await signOut(page);
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
