import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("Children Optimization demo", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "Children Opt");
  });

  test("renders the demo with initial state", async ({ page }) => {
    await expect(page.getByTestId("children-opt-demo")).toBeVisible();
    await expect(page.getByTestId("increment-btn")).toHaveText("Count: 0");
    await expect(page.getByTestId("child-value")).toContainText("value=0");
    await page.screenshot({ path: "test-results/children-opt-initial.png" });
  });

  test("wrapper render count stays at 1 after incrementing", async ({ page }) => {
    // Initial render count should be 1
    await expect(page.getByTestId("render-count-optimized")).toHaveText("renders: 1");

    // Click increment several times
    await page.getByTestId("increment-btn").click();
    await page.getByTestId("increment-btn").click();
    await page.getByTestId("increment-btn").click();

    // Child value updated
    await expect(page.getByTestId("child-value")).toContainText("value=3");

    // Wrapper render count should still be 1 — optimization skipped it
    await expect(page.getByTestId("render-count-optimized")).toHaveText("renders: 1");
    await page.screenshot({ path: "test-results/children-opt-skipped.png" });
  });

  test("child component re-executes when its props change", async ({ page }) => {
    await expect(page.getByTestId("child-render-count")).toHaveText("1");

    await page.getByTestId("increment-btn").click();
    // Child's own render count increases because its props changed
    await expect(page.getByTestId("child-render-count")).toHaveText("2");

    await page.getByTestId("increment-btn").click();
    await expect(page.getByTestId("child-render-count")).toHaveText("3");
  });
});
