/**
 * E2E tests for the $shown prop, which conditionally mounts/unmounts
 * HTML elements and generator components from the DOM.
 */
import { expect, test } from "./fixtures";

/** Helper that mounts the ShownDemo component in the page. */
async function mountShownDemo(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* InfoPanel(_: object) {
      return createElement("div", { "data-testid": "info-panel" }, "I am a generator component");
    }

    function* StatefulCounter(_: object) {
      const [count, setCount] = yield* useState(0);
      return createElement(
        "div",
        { "data-testid": "stateful-counter" },
        createElement(
          "button",
          { "data-testid": "counter-dec", onclick: () => setCount(count - 1) },
          "\u2212",
        ),
        createElement("span", { "data-testid": "counter-val" }, String(count)),
        createElement(
          "button",
          { "data-testid": "counter-inc", onclick: () => setCount(count + 1) },
          "+",
        ),
      );
    }

    function* ShownDemo(_: object) {
      const [showElem, setShowElem] = yield* useState(true);
      const [showFunc, setShowFunc] = yield* useState(true);
      const [showGen, setShowGen] = yield* useState(true);

      return createElement(
        "section",
        null,
        // Toggle for HTML element
        createElement(
          "label",
          null,
          createElement("input", {
            type: "checkbox",
            "data-testid": "toggle-element",
            checked: showElem,
            onchange: () => setShowElem(!showElem),
          }),
          "Show element",
        ),
        createElement(
          "div",
          { $shown: showElem, "data-testid": "shown-element" },
          "Visible element",
        ),

        // Toggle for generator component
        createElement(
          "label",
          null,
          createElement("input", {
            type: "checkbox",
            "data-testid": "toggle-function",
            checked: showFunc,
            onchange: () => setShowFunc(!showFunc),
          }),
          "Show component",
        ),
        createElement(InfoPanel as never, { $shown: showFunc }),

        // Toggle for stateful counter
        createElement(
          "label",
          null,
          createElement("input", {
            type: "checkbox",
            "data-testid": "toggle-generator",
            checked: showGen,
            onchange: () => setShowGen(!showGen),
          }),
          "Show counter",
        ),
        createElement(StatefulCounter as never, { $shown: showGen }),
      );
    }

    render(createElement(ShownDemo as never, {}), document.getElementById("root") as HTMLElement);
  });
}

test("all elements visible initially", async ({ page, setupPage }) => {
  await setupPage();
  await mountShownDemo(page);

  await expect(page.getByTestId("shown-element")).toBeAttached();
  await expect(page.getByTestId("shown-element")).toHaveText("Visible element");
  await expect(page.getByTestId("info-panel")).toBeAttached();
  await expect(page.getByTestId("info-panel")).toHaveText("I am a generator component");
  await expect(page.getByTestId("stateful-counter")).toBeAttached();
  await expect(page.getByTestId("counter-val")).toHaveText("0");
});

test("toggle HTML element off removes it from DOM", async ({ page, setupPage }) => {
  await setupPage();
  await mountShownDemo(page);

  await expect(page.getByTestId("shown-element")).toBeAttached();

  await page.click('[data-testid="toggle-element"]');

  await expect(page.getByTestId("shown-element")).not.toBeAttached();
});

test("toggle HTML element off then on restores it", async ({ page, setupPage }) => {
  await setupPage();
  await mountShownDemo(page);

  // Hide
  await page.click('[data-testid="toggle-element"]');
  await expect(page.getByTestId("shown-element")).not.toBeAttached();

  // Show again
  await page.click('[data-testid="toggle-element"]');
  await expect(page.getByTestId("shown-element")).toBeAttached();
  await expect(page.getByTestId("shown-element")).toHaveText("Visible element");
});

test("toggle generator component off and on", async ({ page, setupPage }) => {
  await setupPage();
  await mountShownDemo(page);

  await expect(page.getByTestId("info-panel")).toBeAttached();

  // Hide
  await page.click('[data-testid="toggle-function"]');
  await expect(page.getByTestId("info-panel")).not.toBeAttached();

  // Show again
  await page.click('[data-testid="toggle-function"]');
  await expect(page.getByTestId("info-panel")).toBeAttached();
  await expect(page.getByTestId("info-panel")).toHaveText("I am a generator component");
});

test("toggle stateful counter off and on resets state to 0", async ({ page, setupPage }) => {
  await setupPage();
  await mountShownDemo(page);

  // Increment counter to 3
  await page.click('[data-testid="counter-inc"]');
  await page.click('[data-testid="counter-inc"]');
  await page.click('[data-testid="counter-inc"]');
  await expect(page.getByTestId("counter-val")).toHaveText("3");

  // Hide the counter
  await page.click('[data-testid="toggle-generator"]');
  await expect(page.getByTestId("stateful-counter")).not.toBeAttached();

  // Show the counter - state should be reset
  await page.click('[data-testid="toggle-generator"]');
  await expect(page.getByTestId("stateful-counter")).toBeAttached();
  await expect(page.getByTestId("counter-val")).toHaveText("0");
});

test("increment counter, toggle off, toggle on produces fresh instance at 0", async ({
  page,
  setupPage,
}) => {
  await setupPage();
  await mountShownDemo(page);

  // Increment to 5
  for (let i = 0; i < 5; i++) {
    await page.click('[data-testid="counter-inc"]');
  }
  await expect(page.getByTestId("counter-val")).toHaveText("5");

  // Toggle off
  await page.click('[data-testid="toggle-generator"]');
  await expect(page.getByTestId("stateful-counter")).not.toBeAttached();

  // Toggle on - fresh instance
  await page.click('[data-testid="toggle-generator"]');
  await expect(page.getByTestId("counter-val")).toHaveText("0");

  // Verify the new instance is fully functional
  await page.click('[data-testid="counter-inc"]');
  await expect(page.getByTestId("counter-val")).toHaveText("1");
});

test("rapid toggle does not break rendering", async ({ page, setupPage }) => {
  await setupPage();
  await mountShownDemo(page);

  // Rapidly toggle the HTML element multiple times
  for (let i = 0; i < 6; i++) {
    await page.click('[data-testid="toggle-element"]');
  }

  // After an even number of toggles, element should be visible
  await expect(page.getByTestId("shown-element")).toBeAttached();
  await expect(page.getByTestId("shown-element")).toHaveText("Visible element");

  // Rapidly toggle the generator component multiple times (odd = hidden)
  for (let i = 0; i < 5; i++) {
    await page.click('[data-testid="toggle-function"]');
  }

  // After an odd number of toggles, component should be hidden
  await expect(page.getByTestId("info-panel")).not.toBeAttached();
});

test("all three can be hidden simultaneously", async ({ page, setupPage }) => {
  await setupPage();
  await mountShownDemo(page);

  // Hide all three
  await page.click('[data-testid="toggle-element"]');
  await page.click('[data-testid="toggle-function"]');
  await page.click('[data-testid="toggle-generator"]');

  await expect(page.getByTestId("shown-element")).not.toBeAttached();
  await expect(page.getByTestId("info-panel")).not.toBeAttached();
  await expect(page.getByTestId("stateful-counter")).not.toBeAttached();

  // The toggle checkboxes should still be present
  await expect(page.getByTestId("toggle-element")).toBeAttached();
  await expect(page.getByTestId("toggle-function")).toBeAttached();
  await expect(page.getByTestId("toggle-generator")).toBeAttached();
});

test("toggling one element does not affect others", async ({ page, setupPage }) => {
  await setupPage();
  await mountShownDemo(page);

  // Hide only the HTML element
  await page.click('[data-testid="toggle-element"]');
  await expect(page.getByTestId("shown-element")).not.toBeAttached();
  await expect(page.getByTestId("info-panel")).toBeAttached();
  await expect(page.getByTestId("stateful-counter")).toBeAttached();

  // Hide only the generator component (HTML element still hidden)
  await page.click('[data-testid="toggle-function"]');
  await expect(page.getByTestId("shown-element")).not.toBeAttached();
  await expect(page.getByTestId("info-panel")).not.toBeAttached();
  await expect(page.getByTestId("stateful-counter")).toBeAttached();

  // Show the HTML element back, others unchanged
  await page.click('[data-testid="toggle-element"]');
  await expect(page.getByTestId("shown-element")).toBeAttached();
  await expect(page.getByTestId("info-panel")).not.toBeAttached();
  await expect(page.getByTestId("stateful-counter")).toBeAttached();
});

test("counter state is truly independent after re-mount", async ({ page, setupPage }) => {
  await setupPage();
  await mountShownDemo(page);

  // Increment counter to 4
  for (let i = 0; i < 4; i++) {
    await page.click('[data-testid="counter-inc"]');
  }
  await expect(page.getByTestId("counter-val")).toHaveText("4");

  // Decrement to 2
  await page.click('[data-testid="counter-dec"]');
  await page.click('[data-testid="counter-dec"]');
  await expect(page.getByTestId("counter-val")).toHaveText("2");

  // Toggle off and on - state resets
  await page.click('[data-testid="toggle-generator"]');
  await expect(page.getByTestId("stateful-counter")).not.toBeAttached();
  await page.click('[data-testid="toggle-generator"]');
  await expect(page.getByTestId("counter-val")).toHaveText("0");

  // Build up new state: decrement to -2
  await page.click('[data-testid="counter-dec"]');
  await page.click('[data-testid="counter-dec"]');
  await expect(page.getByTestId("counter-val")).toHaveText("-2");

  // Toggle off and on again - resets independently
  await page.click('[data-testid="toggle-generator"]');
  await page.click('[data-testid="toggle-generator"]');
  await expect(page.getByTestId("counter-val")).toHaveText("0");
});
