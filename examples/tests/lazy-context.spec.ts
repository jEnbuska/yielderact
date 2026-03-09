import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("Lazy context example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "Lazy Context");
    await page.waitForSelector('[data-testid="lazy-ctx-demo"]');
  });

  // ── initial render ────────────────────────────────────────────────────────

  test("all three consumers render once on mount", async ({ page }) => {
    await expect(page.getByTestId("lazy-ctx-no-selector-renders")).toHaveText("1");
    await expect(page.getByTestId("lazy-ctx-selector-renders")).toHaveText("1");
    await expect(page.getByTestId("lazy-ctx-transform-renders")).toHaveText("1");
    await page.screenshot({ path: "test-results/lazy-ctx-initial.png" });
  });

  test("initial name is Alice for overloads 1 and 2", async ({ page }) => {
    await expect(page.getByTestId("lazy-ctx-no-selector-name")).toHaveText("Alice");
    await expect(page.getByTestId("lazy-ctx-selector-name")).toHaveText("Alice");
  });

  test("initial transform value is ALICE (uppercased)", async ({ page }) => {
    await expect(page.getByTestId("lazy-ctx-transform-value")).toHaveText("ALICE");
  });

  // ── Bump count — only overload 1 should rerender ─────────────────────────

  test("bump count: only overload-1 consumer rerenders", async ({ page }) => {
    await page.getByTestId("lazy-ctx-bump-count").click();

    // Overload 1 must have rerendered (render count increased to 2)
    await expect(page.getByTestId("lazy-ctx-no-selector-renders")).toHaveText("2");

    // Overloads 2 and 3 must NOT have rerendered (still at 1)
    await expect(page.getByTestId("lazy-ctx-selector-renders")).toHaveText("1");
    await expect(page.getByTestId("lazy-ctx-transform-renders")).toHaveText("1");

    await page.screenshot({ path: "test-results/lazy-ctx-bump-count.png" });
  });

  test("bump count multiple times: overload-2 and overload-3 stay at 1", async ({ page }) => {
    await page.getByTestId("lazy-ctx-bump-count").click();
    await page.getByTestId("lazy-ctx-bump-count").click();
    await page.getByTestId("lazy-ctx-bump-count").click();

    await expect(page.getByTestId("lazy-ctx-no-selector-renders")).toHaveText("4");
    await expect(page.getByTestId("lazy-ctx-selector-renders")).toHaveText("1");
    await expect(page.getByTestId("lazy-ctx-transform-renders")).toHaveText("1");
  });

  test("bump count: overload-1 shows updated count value", async ({ page }) => {
    await page.getByTestId("lazy-ctx-bump-count").click();
    await page.getByTestId("lazy-ctx-bump-count").click();

    await expect(page.getByTestId("lazy-ctx-no-selector-count-val")).toHaveText("2");
  });

  // ── Toggle role — only overload 1 should rerender ────────────────────────

  test("toggle role: only overload-1 consumer rerenders", async ({ page }) => {
    await page.getByTestId("lazy-ctx-change-role").click();

    await expect(page.getByTestId("lazy-ctx-no-selector-renders")).toHaveText("2");
    await expect(page.getByTestId("lazy-ctx-selector-renders")).toHaveText("1");
    await expect(page.getByTestId("lazy-ctx-transform-renders")).toHaveText("1");

    await page.screenshot({ path: "test-results/lazy-ctx-toggle-role.png" });
  });

  // ── Toggle name — all three consumers should rerender ────────────────────

  test("toggle name: all three consumers rerender", async ({ page }) => {
    await page.getByTestId("lazy-ctx-change-name").click();

    await expect(page.getByTestId("lazy-ctx-no-selector-renders")).toHaveText("2");
    await expect(page.getByTestId("lazy-ctx-selector-renders")).toHaveText("2");
    await expect(page.getByTestId("lazy-ctx-transform-renders")).toHaveText("2");

    await page.screenshot({ path: "test-results/lazy-ctx-toggle-name.png" });
  });

  test("toggle name: overload-1 and overload-2 show updated name", async ({ page }) => {
    await page.getByTestId("lazy-ctx-change-name").click();

    await expect(page.getByTestId("lazy-ctx-no-selector-name")).toHaveText("Bob");
    await expect(page.getByTestId("lazy-ctx-selector-name")).toHaveText("Bob");
  });

  test("toggle name: overload-3 transform value updates to BOB", async ({ page }) => {
    await page.getByTestId("lazy-ctx-change-name").click();

    await expect(page.getByTestId("lazy-ctx-transform-value")).toHaveText("BOB");
  });

  test("toggle name twice: all consumers back to render count 3, name Alice, transform ALICE", async ({
    page,
  }) => {
    await page.getByTestId("lazy-ctx-change-name").click();
    await page.getByTestId("lazy-ctx-change-name").click();

    await expect(page.getByTestId("lazy-ctx-no-selector-renders")).toHaveText("3");
    await expect(page.getByTestId("lazy-ctx-selector-renders")).toHaveText("3");
    await expect(page.getByTestId("lazy-ctx-transform-renders")).toHaveText("3");

    await expect(page.getByTestId("lazy-ctx-no-selector-name")).toHaveText("Alice");
    await expect(page.getByTestId("lazy-ctx-transform-value")).toHaveText("ALICE");
  });

  // ── Mixed sequence ────────────────────────────────────────────────────────

  test("mixed: bump then toggle name — correct render counts", async ({ page }) => {
    // bump: +1 to overload-1 only → [2, 1, 1]
    await page.getByTestId("lazy-ctx-bump-count").click();
    // toggle name: +1 to all → [3, 2, 2]
    await page.getByTestId("lazy-ctx-change-name").click();
    // bump again: +1 to overload-1 only → [4, 2, 2]
    await page.getByTestId("lazy-ctx-bump-count").click();

    await expect(page.getByTestId("lazy-ctx-no-selector-renders")).toHaveText("4");
    await expect(page.getByTestId("lazy-ctx-selector-renders")).toHaveText("2");
    await expect(page.getByTestId("lazy-ctx-transform-renders")).toHaveText("2");

    await page.screenshot({ path: "test-results/lazy-ctx-mixed.png" });
  });

  test("overload-2 selector hook state preserved: count shown by selector consumer matches overload-1", async ({
    page,
  }) => {
    // bump count 3 times — overload-2 does NOT rerender, so it shows stale count.
    // This is expected: selector consumer skips rerender, thus its displayed
    // count value is from the last time it rendered (mount = 0).
    await page.getByTestId("lazy-ctx-bump-count").click();
    await page.getByTestId("lazy-ctx-bump-count").click();
    await page.getByTestId("lazy-ctx-bump-count").click();

    // Overload 1 sees the latest count (3)
    await expect(page.getByTestId("lazy-ctx-no-selector-count-val")).toHaveText("3");
    // Overload 2 last rendered at mount (count was 0) and has not rerendered
    await expect(page.getByTestId("lazy-ctx-selector-count-val")).toHaveText("0");
  });
});
