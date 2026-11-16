import { expect, test } from "@playwright/test";

import { clearEmailSettings, seedUser } from "./helpers/db";
import { waitForEmail } from "./helpers/email";
import { adminEmail, adminPassword } from "./helpers/env";
import { signOut } from "./helpers/ui";

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

// Serial: later tests depend on the Gmail settings saved (or cleared) earlier.
test.describe.serial("email invitations", () => {
  test.beforeAll(() => {
    clearEmailSettings();
  });

  test("admin saves Gmail settings and sends a test email", async ({ page }) => {
    await adminLogin(page);
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/);

    await page.getByLabel("Gmail address").fill("marina.e2e@gmail.com");
    await page.getByLabel("Sender name").fill("Marina E2E");
    await page.getByLabel("Google app password").fill("abcd efgh ijkl mnop");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Email settings saved." }),
    ).toBeVisible();
    await expect(page.getByText("Email is configured.")).toBeVisible();

    await page.getByLabel("Send a test email to").fill("inbox@marina.test");
    await page.getByRole("button", { name: "Send test email" }).click();
    // The suite always sets EMAIL_CAPTURE_FILE, so the success notice is the
    // capture variant; a live Gmail run would say "Test email sent to …".
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /^Test email (sent to inbox@marina\.test\.|captured by EMAIL_CAPTURE_FILE \(test mode\)\.)$/ }),
    ).toBeVisible();

    const email = await waitForEmail((message) => message.to === "inbox@marina.test");
    expect(email.subject).toContain("test email");
    expect(email.text).toContain("Gmail sending works");

    await signOut(page);
  });

  test("a new user is emailed a temporary password and must replace it", async ({ page }) => {
    const suffix = Date.now().toString(36);
    const username = `invited${suffix}`;
    const email = `${username}@marina.test`;
    const newPassword = "invited-pass-1234";

    await adminLogin(page);
    await page.getByRole("link", { name: "Users" }).click();
    await page.getByRole("button", { name: "New user" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.locator("#user-email").fill(email);
    await dialog.locator("#user-username").fill(username);
    await dialog.getByRole("button", { name: "Create user" }).click();
    // The invitation went out, so the dialog closes without revealing anything.
    await expect(dialog).toBeHidden();

    const invite = await waitForEmail((message) => message.to === email);
    expect(invite.subject).toContain("Marina Shore Power");
    expect(invite.text).toContain(`Username: ${username}`);
    const match = invite.text.match(/Temporary password: (\S+)/);
    expect(match).not.toBeNull();
    const temporaryPassword = match![1];
    expect(temporaryPassword).toHaveLength(16);

    await signOut(page);
    await page.goto("/login");
    await page.getByLabel("Email or username").fill(username);
    await page.getByLabel("Password").fill(temporaryPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account\/password$/);
    await expect(page.getByRole("heading", { name: "Choose your password" })).toBeVisible();

    await page.locator("#new-password").fill(newPassword);
    await page.locator("#confirm-password").fill(newPassword);
    await page.getByRole("button", { name: "Save password and continue" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("No meters assigned yet")).toBeVisible();

    // The temporary password no longer works.
    await signOut(page);
    await page.goto("/login");
    await page.getByLabel("Email or username").fill(username);
    await page.getByLabel("Password").fill(temporaryPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("p[role=alert]")).toContainText(
      "Invalid email/username or password.",
    );
  });

  test("a failed invitation still creates the account and shows the password once", async ({
    page,
  }) => {
    clearEmailSettings(); // simulate "email not configured yet"

    const suffix = Date.now().toString(36);
    const username = `fallback${suffix}`;
    const email = `${username}@marina.test`;

    await adminLogin(page);
    await page.getByRole("link", { name: "Users" }).click();
    await page.getByRole("button", { name: "New user" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.locator("#user-email").fill(email);
    await dialog.locator("#user-username").fill(username);
    await dialog.getByRole("button", { name: "Create user" }).click();

    await expect(dialog.getByText("invitation email could not be sent")).toBeVisible();
    await expect(dialog.getByRole("alert")).toContainText("not configured");
    const temporaryPassword = (await dialog.locator("[data-temp-password]").innerText()).trim();
    expect(temporaryPassword).toHaveLength(16);

    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: username })).toBeVisible();

    // The shown password works and leads straight to the forced-change screen.
    await signOut(page);
    await page.goto("/login");
    await page.getByLabel("Email or username").fill(username);
    await page.getByLabel("Password").fill(temporaryPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account\/password$/);
  });

  test("an expired temporary password is rejected at login", async ({ page }) => {
    seedUser({
      email: "expired-invite@marina.test",
      username: "expiredskipper",
      password: "temp-pass-1234",
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() - 60_000),
    });

    await page.goto("/login");
    await page.getByLabel("Email or username").fill("expiredskipper");
    await page.getByLabel("Password").fill("temp-pass-1234");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("temporary password has expired");
  });
});
