import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("shown prop example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "$shown prop");
    await page.waitForSelector('[data-testid="toggle-element"]');
  });

  test("all three items are visible by default", async ({ page }) => {
    await expect(page.getByTestId("shown-element")).toBeVisible();
    await expect(page.getByTestId("info-panel")).toBeVisible();
    await expect(page.getByTestId("stateful-counter")).toBeVisible();
    await page.screenshot({ path: "test-results/shown-all-visible.png" });
  });

  test("hides and shows the HTML element", async ({ page }) => {
    await page.getByTestId("toggle-element").uncheck();
    await expect(page.getByTestId("shown-element")).not.toBeAttached();
    await page.screenshot({ path: "test-results/shown-element-hidden.png" });

    await page.getByTestId("toggle-element").check();
    await expect(page.getByTestId("shown-element")).toBeVisible();
    await page.screenshot({ path: "test-results/shown-element-shown.png" });
  });

  test("hides and shows the function component", async ({ page }) => {
    await page.getByTestId("toggle-function").uncheck();
    await expect(page.getByTestId("info-panel")).not.toBeAttached();
    await page.screenshot({ path: "test-results/shown-function-hidden.png" });

    await page.getByTestId("toggle-function").check();
    await expect(page.getByTestId("info-panel")).toBeVisible();
    await page.screenshot({ path: "test-results/shown-function-shown.png" });
  });

  test("hides and shows the generator component", async ({ page }) => {
    await page.getByTestId("toggle-generator").uncheck();
    await expect(page.getByTestId("stateful-counter")).not.toBeAttached();
    await page.screenshot({ path: "test-results/shown-generator-hidden.png" });

    await page.getByTestId("toggle-generator").check();
    await expect(page.getByTestId("stateful-counter")).toBeVisible();
    await page.screenshot({ path: "test-results/shown-generator-shown.png" });
  });

  test("generator component state resets after re-mount", async ({ page }) => {
    // Increment the counter inside the generator component
    await page.getByTestId("counter-inc").click();
    await page.getByTestId("counter-inc").click();
    await expect(page.getByTestId("counter-val")).toHaveText("2");

    // Hide then re-show — state should reset to 0
    await page.getByTestId("toggle-generator").uncheck();
    await page.getByTestId("toggle-generator").check();
    await expect(page.getByTestId("counter-val")).toHaveText("0");
    await page.screenshot({ path: "test-results/shown-generator-reset.png" });
  });
});
