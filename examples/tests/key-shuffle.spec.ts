import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("Key Shuffle example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "Key Shuffle");
  });

  // ── Generator components (stateful) ──

  test("renders initial generator component list A, B, C", async ({ page }) => {
    await expect(page.getByTestId("generator-order")).toHaveText("Order: A, B, C");
    await expect(page.getByTestId("item-A")).toBeVisible();
    await expect(page.getByTestId("item-B")).toBeVisible();
    await expect(page.getByTestId("item-C")).toBeVisible();
    await page.screenshot({ path: "test-results/key-shuffle-initial.png" });
  });

  test("reverse preserves generator component state", async ({ page }) => {
    // Increment A twice and B once to give them recognizable state
    await page.getByTestId("inc-A").click();
    await page.getByTestId("inc-A").click();
    await expect(page.getByTestId("count-A")).toHaveText("2");

    await page.getByTestId("inc-B").click();
    await expect(page.getByTestId("count-B")).toHaveText("1");

    // Reverse: C, B, A
    await page.getByTestId("reverse-btn").click();
    await expect(page.getByTestId("generator-order")).toHaveText("Order: C, B, A");

    // State must be preserved after reorder
    await expect(page.getByTestId("count-A")).toHaveText("2");
    await expect(page.getByTestId("count-B")).toHaveText("1");
    await expect(page.getByTestId("count-C")).toHaveText("0");
    await page.screenshot({ path: "test-results/key-shuffle-reversed.png" });
  });

  test("DOM nodes are moved, not recreated, on reverse", async ({ page }) => {
    // Capture initial DOM node identity via a data attribute written by JS
    await page.getByTestId("item-A").evaluate((el) => el.setAttribute("data-marker", "original-A"));
    await page.getByTestId("item-B").evaluate((el) => el.setAttribute("data-marker", "original-B"));
    await page.getByTestId("item-C").evaluate((el) => el.setAttribute("data-marker", "original-C"));

    await page.getByTestId("reverse-btn").click();
    await expect(page.getByTestId("generator-order")).toHaveText("Order: C, B, A");

    // The marker attributes survive only if the DOM node was moved, not recreated
    await expect(page.getByTestId("item-A")).toHaveAttribute("data-marker", "original-A");
    await expect(page.getByTestId("item-B")).toHaveAttribute("data-marker", "original-B");
    await expect(page.getByTestId("item-C")).toHaveAttribute("data-marker", "original-C");
    await page.screenshot({ path: "test-results/key-shuffle-dom-identity.png" });
  });

  test("components keep working after reorder", async ({ page }) => {
    await page.getByTestId("reverse-btn").click();
    await expect(page.getByTestId("generator-order")).toHaveText("Order: C, B, A");

    // Increment C after reorder
    await page.getByTestId("inc-C").click();
    await page.getByTestId("inc-C").click();
    await expect(page.getByTestId("count-C")).toHaveText("2");

    // Increment A after reorder
    await page.getByTestId("inc-A").click();
    await expect(page.getByTestId("count-A")).toHaveText("1");

    await page.screenshot({ path: "test-results/key-shuffle-post-reorder-increment.png" });
  });

  test("add and remove items", async ({ page }) => {
    // Add D
    await page.getByTestId("add-btn").click();
    await expect(page.getByTestId("generator-order")).toHaveText("Order: A, B, C, D");
    await expect(page.getByTestId("item-D")).toBeVisible();

    // Remove last (D)
    await page.getByTestId("remove-last-btn").click();
    await expect(page.getByTestId("generator-order")).toHaveText("Order: A, B, C");
    await expect(page.getByTestId("item-D")).not.toBeVisible();

    await page.screenshot({ path: "test-results/key-shuffle-add-remove.png" });
  });

  test("shuffle then reverse preserves state", async ({ page }) => {
    // Build up some state
    await page.getByTestId("inc-A").click();
    await page.getByTestId("inc-A").click();
    await page.getByTestId("inc-A").click();
    await expect(page.getByTestId("count-A")).toHaveText("3");

    // Shuffle (deterministic check: state values survive)
    await page.getByTestId("shuffle-btn").click();
    await expect(page.getByTestId("count-A")).toHaveText("3");

    // Reverse again
    await page.getByTestId("reverse-btn").click();
    await expect(page.getByTestId("count-A")).toHaveText("3");
    await expect(page.getByTestId("count-B")).toHaveText("0");
    await expect(page.getByTestId("count-C")).toHaveText("0");

    await page.screenshot({ path: "test-results/key-shuffle-shuffle-reverse.png" });
  });

  // ── Plain function components ──

  test("renders initial tag list", async ({ page }) => {
    await expect(page.getByTestId("tag-order")).toHaveText("Order: red, green, blue");
    await expect(page.getByTestId("tag-red")).toBeVisible();
    await expect(page.getByTestId("tag-green")).toBeVisible();
    await expect(page.getByTestId("tag-blue")).toBeVisible();
  });

  test("reverse tags moves DOM nodes", async ({ page }) => {
    await page.getByTestId("tag-red").evaluate((el) => el.setAttribute("data-marker", "orig-red"));
    await page
      .getByTestId("tag-blue")
      .evaluate((el) => el.setAttribute("data-marker", "orig-blue"));

    await page.getByTestId("tag-reverse-btn").click();
    await expect(page.getByTestId("tag-order")).toHaveText("Order: blue, green, red");

    // DOM identity preserved
    await expect(page.getByTestId("tag-red")).toHaveAttribute("data-marker", "orig-red");
    await expect(page.getByTestId("tag-blue")).toHaveAttribute("data-marker", "orig-blue");
    await page.screenshot({ path: "test-results/key-shuffle-tags-reversed.png" });
  });

  // ── Keyed HTML elements ──

  test("renders initial element list", async ({ page }) => {
    await expect(page.getByTestId("elem-order")).toHaveText("Order: first, second, third");
    await expect(page.getByTestId("elem-first")).toHaveText("first");
    await expect(page.getByTestId("elem-second")).toHaveText("second");
    await expect(page.getByTestId("elem-third")).toHaveText("third");
  });

  test("reverse elements moves DOM nodes", async ({ page }) => {
    await page.getByTestId("elem-first").evaluate((el) => el.setAttribute("data-marker", "orig-1"));
    await page.getByTestId("elem-third").evaluate((el) => el.setAttribute("data-marker", "orig-3"));

    await page.getByTestId("elem-reverse-btn").click();
    await expect(page.getByTestId("elem-order")).toHaveText("Order: third, second, first");

    // DOM identity preserved
    await expect(page.getByTestId("elem-first")).toHaveAttribute("data-marker", "orig-1");
    await expect(page.getByTestId("elem-third")).toHaveAttribute("data-marker", "orig-3");

    // Verify visual order in the DOM
    const texts = await page.getByTestId("elem-list").locator("li").allTextContents();
    expect(texts).toEqual(["third", "second", "first"]);

    await page.screenshot({ path: "test-results/key-shuffle-elems-reversed.png" });
  });
});
