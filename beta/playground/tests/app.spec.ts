import { expect, test } from "@playwright/test";
import { goToApp } from "./helpers";

test.describe("App shell", () => {
  test("loads and shows the heading", async ({ page }) => {
    await goToApp(page);
    await expect(page.getByTestId("app-heading")).toHaveText("yract-beta playground");
    await page.screenshot({ path: "test-results/app-loaded.png" });
  });

  test("shows all tabs", async ({ page }) => {
    await goToApp(page);
    // Tabs that exist in the beta playground (demos for not-yet-implemented
    // features — data, raw, confirm, deps, portal — are intentionally absent).
    await expect(page.getByTestId("tab-counter")).toBeVisible();
    await expect(page.getByTestId("tab-todos")).toBeVisible();
    await expect(page.getByTestId("tab-theme")).toBeVisible();
    await expect(page.getByTestId("tab-hooks")).toBeVisible();
    await expect(page.getByTestId("tab-shown")).toBeVisible();
    await expect(page.getByTestId("tab-effect")).toBeVisible();
    await expect(page.getByTestId("tab-context")).toBeVisible();
    await expect(page.getByTestId("tab-lazy-ctx")).toBeVisible();
    await expect(page.getByTestId("tab-abort-signal")).toBeVisible();
    await expect(page.getByTestId("tab-key-shuffle")).toBeVisible();
  });
});
