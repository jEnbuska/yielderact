import { expect, test } from "@playwright/test";
import { clickTab, goToApp } from "./helpers";

test.describe("$deps prop example", () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await clickTab(page, "$deps prop");
    await page.waitForSelector('[data-testid="deps-with-deps"]');
  });

  // ── Component with $deps ─────────────────────────────────────────────

  test("both counters start at 1 render", async ({ page }) => {
    await expect(page.getByTestId("deps-with-deps-renders")).toHaveText("1");
    await expect(page.getByTestId("deps-without-deps-renders")).toHaveText("1");
  });

  test("incrementing relevant rerenders both counters", async ({ page }) => {
    await page.getByTestId("deps-inc-relevant").click();
    await expect(page.getByTestId("deps-with-deps-renders")).toHaveText("2");
    await expect(page.getByTestId("deps-without-deps-renders")).toHaveText("2");
    await expect(page.getByTestId("deps-with-deps-value")).toHaveText("1");
  });

  test("incrementing irrelevant only rerenders the counter without $deps", async ({ page }) => {
    await page.getByTestId("deps-inc-irrelevant").click();
    await expect(page.getByTestId("deps-with-deps-renders")).toHaveText("1");
    await expect(page.getByTestId("deps-without-deps-renders")).toHaveText("2");
  });

  test("multiple irrelevant clicks keep with-deps render count at 1", async ({ page }) => {
    await page.getByTestId("deps-inc-irrelevant").click();
    await page.getByTestId("deps-inc-irrelevant").click();
    await page.getByTestId("deps-inc-irrelevant").click();
    await expect(page.getByTestId("deps-with-deps-renders")).toHaveText("1");
    await expect(page.getByTestId("deps-without-deps-renders")).toHaveText("4");
  });

  // ── Element with $deps ────────────────────────────────────────────────

  test("element with $deps: irrelevant click does not update text", async ({ page }) => {
    await expect(page.getByTestId("deps-element-text")).toHaveText("relevant=0 irrelevant=0");
    await page.getByTestId("deps-inc-irrelevant").click();
    // Entire subtree frozen — text should NOT update
    await expect(page.getByTestId("deps-element-text")).toHaveText("relevant=0 irrelevant=0");
  });

  test("element with $deps: relevant click updates text", async ({ page }) => {
    await page.getByTestId("deps-inc-relevant").click();
    await expect(page.getByTestId("deps-element-text")).toHaveText("relevant=1 irrelevant=0");
  });

  // ── Nested elements with $deps ────────────────────────────────────────

  test("nested elements: irrelevant click does not update nested text", async ({ page }) => {
    await expect(page.getByTestId("deps-nested-text")).toHaveText("relevant=0 irrelevant=0");
    await page.getByTestId("deps-inc-irrelevant").click();
    await expect(page.getByTestId("deps-nested-text")).toHaveText("relevant=0 irrelevant=0");
  });

  test("nested elements: relevant click updates nested text", async ({ page }) => {
    await page.getByTestId("deps-inc-relevant").click();
    await expect(page.getByTestId("deps-nested-text")).toHaveText("relevant=1 irrelevant=0");
  });

  // ── Component with component children ─────────────────────────────────

  test("component with component children: child skipped on irrelevant click", async ({ page }) => {
    await expect(page.getByTestId("deps-comp-with-comp-children-renders")).toHaveText("1");
    await expect(page.getByTestId("deps-nested-comp-child-renders")).toHaveText("1");
    await page.getByTestId("deps-inc-irrelevant").click();
    // Parent skipped → child not re-rendered
    await expect(page.getByTestId("deps-comp-with-comp-children-renders")).toHaveText("1");
    await expect(page.getByTestId("deps-nested-comp-child-renders")).toHaveText("1");
  });

  test("component with component children: parent rerenders on relevant click, child props unchanged so child skips", async ({
    page,
  }) => {
    await page.getByTestId("deps-inc-relevant").click();
    await expect(page.getByTestId("deps-comp-with-comp-children-renders")).toHaveText("2");
    // Child's own props (label) didn't change, so shallowEqual skips it
    await expect(page.getByTestId("deps-nested-comp-child-renders")).toHaveText("1");
  });

  // ── Component with element children ───────────────────────────────────

  test("component with element children: child frozen on irrelevant click", async ({ page }) => {
    await expect(page.getByTestId("deps-nested-elem-child")).toHaveText("relevant=0 irrelevant=0");
    await page.getByTestId("deps-inc-irrelevant").click();
    // Parent skipped → element child not updated
    await expect(page.getByTestId("deps-comp-with-elem-children-renders")).toHaveText("1");
    await expect(page.getByTestId("deps-nested-elem-child")).toHaveText("relevant=0 irrelevant=0");
  });

  test("component with element children: child updated on relevant click", async ({ page }) => {
    await page.getByTestId("deps-inc-relevant").click();
    await expect(page.getByTestId("deps-comp-with-elem-children-renders")).toHaveText("2");
    // Element child gets new content from parent's rerender
    await expect(page.getByTestId("deps-nested-elem-child")).toHaveText("relevant=1 irrelevant=0");
  });
});
