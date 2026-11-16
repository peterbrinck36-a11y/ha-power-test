import { expect, test } from "@playwright/test";

test.describe("theme toggle", () => {
  test("switches to dark mode and remembers the choice", async ({ page }) => {
    await page.goto("/login");

    const html = page.locator("html");
    await expect(html).not.toHaveClass(/dark/);

    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(html).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("marina-theme"))).toBe("dark");

    await page.reload();
    await expect(html).toHaveClass(/dark/);

    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(html).not.toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem("marina-theme"))).toBe("light");
  });
});
