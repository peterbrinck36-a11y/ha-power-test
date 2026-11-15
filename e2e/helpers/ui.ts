import { expect, type Page } from "@playwright/test";

/** Fills the login form and submits, then waits for the redirect to settle. */
export async function login(
  page: Page,
  identifier: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Either an alert (failure) or a redirect (success) — let callers assert.
  await page.waitForLoadState("networkidle");
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function fillDialogField(
  page: Page,
  id: string,
  value: string,
): Promise<void> {
  await page.locator(`#${id}`).fill(value);
}
