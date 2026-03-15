import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("Slot API example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "Slot API");
    await page.waitForSelector('[data-testid="slot-header"]');
  });

  test("initial state: header and footer content is visible", async ({ page }) => {
    await expect(page.getByTestId("slot-header")).toBeVisible();
    await expect(page.getByTestId("slot-footer")).toBeVisible();
    await expect(page.getByTestId("slot-header-content")).toBeVisible();

    await page.screenshot({ path: "test-results/slot-initial.png" });
  });

  test("update button changes header content", async ({ page }) => {
    const headerText = page.getByTestId("slot-header-content");
    const initialText = await headerText.textContent();

    await page.getByTestId("slot-update-header").click();

    await expect(headerText).not.toHaveText(initialText ?? "");

    await page.screenshot({ path: "test-results/slot-updated.png" });
  });

  test("visual regression: slot layout", async ({ page }) => {
    await page.screenshot({ path: "test-results/slot-layout.png" });

    await page.getByTestId("slot-update-header").click();
    await page.screenshot({
      path: "test-results/slot-layout-after-update.png",
    });
  });
});
