import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("Context Scoping demo", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "Context Scoping");
    await page.waitForSelector('[data-testid="independent-panel"]');
  });

  // ── 1. Two independent contexts ─────────────────────────────────────────

  test("shows initial theme and locale in independent panel", async ({ page }) => {
    await expect(page.getByTestId("theme-badge")).toHaveText("light");
    await expect(page.getByTestId("locale-badge")).toHaveText("en");
    await expect(page.getByTestId("both-badge")).toHaveText("light/en");
    await page.screenshot({ path: "test-results/context-initial.png" });
  });

  test("toggling theme does not change locale", async ({ page }) => {
    await page.getByTestId("toggle-theme-btn").click();
    await expect(page.getByTestId("theme-badge")).toHaveText("dark");
    await expect(page.getByTestId("locale-badge")).toHaveText("en");
    await expect(page.getByTestId("both-badge")).toHaveText("dark/en");
    await page.screenshot({ path: "test-results/context-theme-toggled.png" });
  });

  test("toggling locale does not change theme", async ({ page }) => {
    await page.getByTestId("toggle-locale-btn").click();
    await expect(page.getByTestId("locale-badge")).toHaveText("fi");
    await expect(page.getByTestId("theme-badge")).toHaveText("light");
    await expect(page.getByTestId("both-badge")).toHaveText("light/fi");
    await page.screenshot({ path: "test-results/context-locale-toggled.png" });
  });

  test("toggling both contexts updates the combined badge", async ({ page }) => {
    await page.getByTestId("toggle-theme-btn").click();
    await page.getByTestId("toggle-locale-btn").click();
    await expect(page.getByTestId("both-badge")).toHaveText("dark/fi");
    await page.screenshot({ path: "test-results/context-both-toggled.png" });
  });

  // ── 2. Nested Provider override ─────────────────────────────────────────

  test("inner card always shows dark even when outer theme is light", async ({ page }) => {
    await expect(page.getByTestId("outer-theme-badge")).toHaveText("light");
    await expect(page.getByTestId("inner-theme-badge")).toHaveText("dark");
    await page.screenshot({ path: "test-results/context-nested-initial.png" });
  });

  test("inner card stays dark after outer theme toggles to dark", async ({ page }) => {
    await page.getByTestId("toggle-theme-btn").click();
    await expect(page.getByTestId("outer-theme-badge")).toHaveText("dark");
    await expect(page.getByTestId("inner-theme-badge")).toHaveText("dark");
    await page.screenshot({ path: "test-results/context-nested-outer-dark.png" });
  });

  test("inner card stays dark after outer theme toggles back to light", async ({ page }) => {
    await page.getByTestId("toggle-theme-btn").click(); // → dark
    await page.getByTestId("toggle-theme-btn").click(); // → light again
    await expect(page.getByTestId("inner-theme-badge")).toHaveText("dark");
  });

  // ── 3. State preserved across context updates ───────────────────────────

  test("consumer state is preserved when context value changes", async ({ page }) => {
    // Increment the counter three times
    await page.getByTestId("stateful-inc").click();
    await page.getByTestId("stateful-inc").click();
    await page.getByTestId("stateful-inc").click();
    await expect(page.getByTestId("stateful-count")).toHaveText("3");

    // Toggle the outer theme – this changes the context value flowing into the consumer
    await page.getByTestId("toggle-theme-btn").click();

    // Consumer must reflect the new theme…
    await expect(page.getByTestId("stateful-theme")).toHaveText("dark");
    // …but the counter state must be preserved (not reset to 0)
    await expect(page.getByTestId("stateful-count")).toHaveText("3");
    await page.screenshot({ path: "test-results/context-state-preserved.png" });
  });

  // ── 4. Sibling providers are isolated ───────────────────────────────────

  test("sibling providers start with independent values", async ({ page }) => {
    await expect(page.getByTestId("sibling-a")).toHaveText("light");
    await expect(page.getByTestId("sibling-b")).toHaveText("dark");
    await page.screenshot({ path: "test-results/context-siblings-initial.png" });
  });

  test("toggling sibling A does not affect sibling B", async ({ page }) => {
    await page.getByTestId("toggle-sibling-a").click();
    await expect(page.getByTestId("sibling-a")).toHaveText("dark");
    await expect(page.getByTestId("sibling-b")).toHaveText("dark");
    await page.screenshot({ path: "test-results/context-sibling-a-toggled.png" });
  });

  test("toggling sibling B does not affect sibling A", async ({ page }) => {
    await page.getByTestId("toggle-sibling-b").click();
    await expect(page.getByTestId("sibling-a")).toHaveText("light");
    await expect(page.getByTestId("sibling-b")).toHaveText("light");
    await page.screenshot({ path: "test-results/context-sibling-b-toggled.png" });
  });

  test("both sibling providers can be toggled independently", async ({ page }) => {
    await page.getByTestId("toggle-sibling-a").click();
    await page.getByTestId("toggle-sibling-b").click();
    await expect(page.getByTestId("sibling-a")).toHaveText("dark");
    await expect(page.getByTestId("sibling-b")).toHaveText("light");
    await page.screenshot({ path: "test-results/context-siblings-both-toggled.png" });
  });
});
