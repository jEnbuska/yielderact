import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("$deps prop example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "$deps prop");
    await page.waitForSelector('[data-testid="deps-with-deps"]');
  });

  test("both counters start at 1 render", async ({ page }) => {
    await expect(page.getByTestId("deps-with-deps-renders")).toHaveText("1");
    await expect(page.getByTestId("deps-without-deps-renders")).toHaveText("1");
    await page.screenshot({ path: "test-results/deps-initial.png" });
  });

  test("incrementing relevant rerenders both counters", async ({ page }) => {
    await page.getByTestId("deps-inc-relevant").click();
    await expect(page.getByTestId("deps-with-deps-renders")).toHaveText("2");
    await expect(page.getByTestId("deps-without-deps-renders")).toHaveText("2");
    await expect(page.getByTestId("deps-with-deps-value")).toHaveText("1");
    await page.screenshot({ path: "test-results/deps-relevant-click.png" });
  });

  test("incrementing irrelevant only rerenders the counter without $deps", async ({ page }) => {
    await page.getByTestId("deps-inc-irrelevant").click();
    // With $deps: render count stays at 1 — deps didn't change
    await expect(page.getByTestId("deps-with-deps-renders")).toHaveText("1");
    // Without $deps: render count goes to 2 — props reference changed
    await expect(page.getByTestId("deps-without-deps-renders")).toHaveText("2");
    await page.screenshot({ path: "test-results/deps-irrelevant-click.png" });
  });

  test("multiple irrelevant clicks keep with-deps render count at 1", async ({ page }) => {
    await page.getByTestId("deps-inc-irrelevant").click();
    await page.getByTestId("deps-inc-irrelevant").click();
    await page.getByTestId("deps-inc-irrelevant").click();
    await expect(page.getByTestId("deps-with-deps-renders")).toHaveText("1");
    await expect(page.getByTestId("deps-without-deps-renders")).toHaveText("4");
    await page.screenshot({ path: "test-results/deps-multiple-irrelevant.png" });
  });
});
