/**
 * E2E tests for HooksShowcase component exercising useId, useMemo, and useRef
 * hooks in a fruit-filtering search interface.
 */
import { expect, test } from "./fixtures";

/** Helper that mounts the HooksShowcase component in the page. */
async function mountHooksShowcase(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const { createElement, render, useState, useId, useMemo, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* HooksShowcase(_: object) {
      const inputId = yield* useId();
      const [query, setQuery] = yield* useState("");
      const renderCount = yield* useRef(0);
      renderCount.current += 1;

      const FRUITS = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];
      const filtered = yield* useMemo(
        (q: string) => FRUITS.filter((f) => f.toLowerCase().includes(q.toLowerCase())),
        [query],
      );

      return createElement(
        "div",
        null,
        createElement("label", { "data-testid": "search-label", htmlFor: inputId }, "Search:"),
        createElement("input", {
          id: inputId,
          "data-testid": "search-input",
          type: "text",
          value: query,
          oninput: (e: { target: HTMLInputElement }) => setQuery(e.target.value),
        }),
        createElement(
          "ul",
          { "data-testid": "fruit-list" },
          ...filtered.map((f: string) =>
            createElement("li", { $key: f, "data-testid": `fruit-${f.toLowerCase()}` }, f),
          ),
        ),
        createElement(
          "p",
          {
            $shown: filtered.length === 0,
            "data-testid": "no-results",
          },
          `No match for "${query}"`,
        ),
        createElement("p", { "data-testid": "render-count" }, `Renders: ${renderCount.current}`),
      );
    }

    render(
      createElement(HooksShowcase as never, {}),
      document.getElementById("root") as HTMLElement,
    );
  });
}

test("initial render shows all five fruits", async ({ page, setupPage }) => {
  await setupPage();
  await mountHooksShowcase(page);

  const items = page.locator('[data-testid="fruit-list"] li');
  await expect(items).toHaveCount(5);
  await expect(page.getByTestId("fruit-apple")).toHaveText("Apple");
  await expect(page.getByTestId("fruit-banana")).toHaveText("Banana");
  await expect(page.getByTestId("fruit-cherry")).toHaveText("Cherry");
  await expect(page.getByTestId("fruit-date")).toHaveText("Date");
  await expect(page.getByTestId("fruit-elderberry")).toHaveText("Elderberry");
});

test("typing a query filters the fruit list", async ({ page, setupPage }) => {
  await setupPage();
  await mountHooksShowcase(page);

  await page.fill('[data-testid="search-input"]', "ban");

  const items = page.locator('[data-testid="fruit-list"] li');
  await expect(items).toHaveCount(1);
  await expect(page.getByTestId("fruit-banana")).toHaveText("Banana");
});

test("clearing query restores all fruits", async ({ page, setupPage }) => {
  await setupPage();
  await mountHooksShowcase(page);

  // Filter down first
  await page.fill('[data-testid="search-input"]', "cherry");
  const items = page.locator('[data-testid="fruit-list"] li');
  await expect(items).toHaveCount(1);

  // Clear the input
  await page.fill('[data-testid="search-input"]', "");
  await expect(items).toHaveCount(5);
});

test("no results message appears for non-matching query", async ({ page, setupPage }) => {
  await setupPage();
  await mountHooksShowcase(page);

  await page.fill('[data-testid="search-input"]', "xyz");

  const items = page.locator('[data-testid="fruit-list"] li');
  await expect(items).toHaveCount(0);
  await expect(page.getByTestId("no-results")).toBeVisible();
  await expect(page.getByTestId("no-results")).toHaveText('No match for "xyz"');
});

test("no results message is hidden when some fruits match", async ({ page, setupPage }) => {
  await setupPage();
  await mountHooksShowcase(page);

  // Initially all fruits match so the message should be hidden
  await expect(page.getByTestId("no-results")).toBeHidden();

  // Filter to something that matches
  await page.fill('[data-testid="search-input"]', "app");
  await expect(page.getByTestId("fruit-apple")).toBeVisible();
  await expect(page.getByTestId("no-results")).toBeHidden();
});

test("useId generates a valid string id and label htmlFor matches input id", async ({
  page,
  setupPage,
}) => {
  await setupPage();
  await mountHooksShowcase(page);

  const inputId = await page.locator('[data-testid="search-input"]').getAttribute("id");
  const labelFor = await page.locator('[data-testid="search-label"]').getAttribute("for");

  // The id should be a non-empty string
  expect(inputId).toBeTruthy();
  expect(typeof inputId).toBe("string");

  // The label's htmlFor should match the input's id
  expect(labelFor).toBe(inputId);
});

test("render count increments on each state change", async ({ page, setupPage }) => {
  await setupPage();
  await mountHooksShowcase(page);

  // Initial render: count should be 1
  await expect(page.getByTestId("render-count")).toHaveText("Renders: 1");

  // Type a character to trigger a state change
  await page.fill('[data-testid="search-input"]', "a");
  await expect(page.getByTestId("render-count")).toHaveText("Renders: 2");

  // Type another character
  await page.fill('[data-testid="search-input"]', "ap");
  await expect(page.getByTestId("render-count")).toHaveText("Renders: 3");
});

test("case-insensitive filtering works", async ({ page, setupPage }) => {
  await setupPage();
  await mountHooksShowcase(page);

  // Type uppercase "APPLE"
  await page.fill('[data-testid="search-input"]', "APPLE");
  const items = page.locator('[data-testid="fruit-list"] li');
  await expect(items).toHaveCount(1);
  await expect(page.getByTestId("fruit-apple")).toHaveText("Apple");

  // Type mixed case "ElDeR"
  await page.fill('[data-testid="search-input"]', "ElDeR");
  await expect(items).toHaveCount(1);
  await expect(page.getByTestId("fruit-elderberry")).toHaveText("Elderberry");
});
