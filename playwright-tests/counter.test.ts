/**
 * E2E tests for a Counter component with increment, decrement, and reset
 * buttons, exercising various state-update scenarios.
 */
import { expect, test } from "./fixtures";

/** Helper that sets up the Counter component in the page. */
async function mountCounter(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Counter(_: object) {
      const [count, setCount] = yield* useState(0);
      return createElement(
        "section",
        null,
        createElement(
          "button",
          { "data-testid": "decrement-btn", onclick: () => setCount(count - 1) },
          "\u2212",
        ),
        createElement("span", { "data-testid": "counter-value" }, String(count)),
        createElement(
          "button",
          { "data-testid": "increment-btn", onclick: () => setCount(count + 1) },
          "+",
        ),
        createElement(
          "button",
          {
            "data-testid": "reset-btn",
            onclick: () => setCount(0),
            style: "margin-left:0.5rem",
          },
          "Reset",
        ),
      );
    }

    render(createElement(Counter as never, {}), document.getElementById("root") as HTMLElement);
  });
}

test("initial render shows 0", async ({ page, setupPage }) => {
  await setupPage();
  await mountCounter(page);

  await expect(page.getByTestId("counter-value")).toHaveText("0");
});

test("increment button increases count", async ({ page, setupPage }) => {
  await setupPage();
  await mountCounter(page);

  await page.getByTestId("increment-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("1");

  await page.getByTestId("increment-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("2");
});

test("decrement button decreases count including going negative", async ({ page, setupPage }) => {
  await setupPage();
  await mountCounter(page);

  await page.getByTestId("decrement-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("-1");

  await page.getByTestId("decrement-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("-2");
});

test("reset button sets count to 0", async ({ page, setupPage }) => {
  await setupPage();
  await mountCounter(page);

  // Increment a few times first
  await page.getByTestId("increment-btn").click();
  await page.getByTestId("increment-btn").click();
  await page.getByTestId("increment-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("3");

  // Reset
  await page.getByTestId("reset-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("0");
});

test("multiple rapid increments work correctly", async ({ page, setupPage }) => {
  await setupPage();
  await mountCounter(page);

  for (let i = 0; i < 5; i++) {
    await page.getByTestId("increment-btn").click();
  }

  await expect(page.getByTestId("counter-value")).toHaveText("5");
});

test("increment then reset back to 0", async ({ page, setupPage }) => {
  await setupPage();
  await mountCounter(page);

  await page.getByTestId("increment-btn").click();
  await page.getByTestId("increment-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("2");

  await page.getByTestId("reset-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("0");
});

test("decrement to negative then increment back to 0", async ({ page, setupPage }) => {
  await setupPage();
  await mountCounter(page);

  // Go negative
  await page.getByTestId("decrement-btn").click();
  await page.getByTestId("decrement-btn").click();
  await page.getByTestId("decrement-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("-3");

  // Increment back to 0
  await page.getByTestId("increment-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("-2");

  await page.getByTestId("increment-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("-1");

  await page.getByTestId("increment-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("0");
});

test("multiple rapid alternating clicks maintain correct count", async ({ page, setupPage }) => {
  await setupPage();
  await mountCounter(page);

  // inc, dec, inc, dec — net effect is 0
  await page.getByTestId("increment-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("1");

  await page.getByTestId("decrement-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("0");

  await page.getByTestId("increment-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("1");

  await page.getByTestId("decrement-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("0");
});
