import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("Data Fetcher example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "Data Fetcher");
  });

  test("shows loading state initially", async ({ page }) => {
    await expect(page.getByTestId("loading-message")).toBeVisible();
    await page.screenshot({ path: "test-results/data-loading.png" });
  });

  test("shows user data after promise resolves", async ({ page }) => {
    // Wait up to 5 s for the simulated 1.5 s fetch to complete
    await expect(page.getByTestId("user-data")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("user-data")).toContainText("Jane Doe");
    await page.screenshot({ path: "test-results/data-loaded.png" });
  });
});
