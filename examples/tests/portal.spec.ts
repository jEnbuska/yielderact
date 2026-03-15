import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("Portal example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "createPortal");
    await page.waitForSelector('[data-testid="portal-target"]');
  });

  test("modal is not visible by default", async ({ page }) => {
    await expect(page.getByTestId("portal-modal")).not.toBeAttached();
    await page.screenshot({ path: "test-results/portal-initial.png" });
  });

  test("opening modal renders content into portal target", async ({ page }) => {
    await page.getByTestId("portal-toggle-modal").click();
    await expect(page.getByTestId("portal-modal")).toBeVisible();

    // Verify the modal is inside the portal target container
    const isInsideTarget = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="portal-modal"]');
      const target = document.querySelector('[data-testid="portal-target"]');
      return target?.contains(modal) ?? false;
    });
    expect(isInsideTarget).toBe(true);

    await page.screenshot({ path: "test-results/portal-opened.png" });
  });

  test("closing modal removes portal content", async ({ page }) => {
    await page.getByTestId("portal-toggle-modal").click();
    await expect(page.getByTestId("portal-modal")).toBeVisible();

    await page.getByTestId("portal-toggle-modal").click();
    await expect(page.getByTestId("portal-modal")).not.toBeAttached();
    await page.screenshot({ path: "test-results/portal-closed.png" });
  });

  test("portal inherits context: theme value flows through", async ({ page }) => {
    await page.getByTestId("portal-toggle-modal").click();
    await expect(page.getByTestId("portal-theme-value")).toContainText("light");

    // Toggle theme
    await page.getByTestId("portal-toggle-theme").click();
    await expect(page.getByTestId("portal-theme-value")).toContainText("dark");

    // Toggle back
    await page.getByTestId("portal-toggle-theme").click();
    await expect(page.getByTestId("portal-theme-value")).toContainText("light");

    await page.screenshot({ path: "test-results/portal-context.png" });
  });

  test("events work inside portal: counter responds to clicks", async ({ page }) => {
    await page.getByTestId("portal-toggle-modal").click();
    await expect(page.getByTestId("portal-counter-value")).toHaveText("0");

    // Click increment — should be exactly 1 (no double-firing)
    await page.getByTestId("portal-counter-inc").click();
    await expect(page.getByTestId("portal-counter-value")).toHaveText("1");

    // Click decrement — back to 0
    await page.getByTestId("portal-counter-dec").click();
    await expect(page.getByTestId("portal-counter-value")).toHaveText("0");

    await page.screenshot({ path: "test-results/portal-events.png" });
  });
});
