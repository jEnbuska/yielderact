import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("Hooks Showcase example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "Hooks Showcase");
    await page.waitForSelector('[data-testid="hooks-search-input"]');
  });

  test("renders the full fruit list initially", async ({ page }) => {
    const items = page.locator('[data-testid^="fruit-"]');
    await expect(items).toHaveCount(12);
    await page.screenshot({ path: "test-results/hooks-initial.png" });
  });

  test("filters the list via useMemo when the search input changes", async ({ page }) => {
    await page.getByTestId("hooks-search-input").fill("an");
    const items = page.locator('[data-testid^="fruit-"]');
    // 'Banana', 'Mango' contain 'an' (Nectarine does not)
    await expect(items).toHaveCount(2);
    await page.screenshot({ path: "test-results/hooks-filtered.png" });
  });

  test("shows no-results message when no fruits match", async ({ page }) => {
    await page.getByTestId("hooks-search-input").fill("zzz");
    await expect(page.getByTestId("hooks-no-results")).toBeVisible();
    await page.screenshot({ path: "test-results/hooks-no-results.png" });
  });

  test("shows render count tracked by useRef", async ({ page }) => {
    await expect(page.getByTestId("hooks-render-count")).toContainText("rendered");
    await page.screenshot({ path: "test-results/hooks-render-count.png" });
  });

  test("search input label is associated via useId", async ({ page }) => {
    const input = page.getByTestId("hooks-search-input");
    const inputId = await input.getAttribute("id");
    expect(inputId).toBeTruthy();
    // The label's htmlFor must match the input's id
    const label = page.getByTestId("hooks-search-label");
    await expect(label).toBeVisible();
    const labelFor = await label.getAttribute("for");
    expect(labelFor).toBe(inputId);
  });
});
