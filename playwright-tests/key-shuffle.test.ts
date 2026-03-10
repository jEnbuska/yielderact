/**
 * E2E tests for keyed reconciliation using the $key prop.
 *
 * A list of stateful CounterItem components is rendered with $key.
 * The order array is mutated via a window-exposed __setOrder callback,
 * and each test verifies that component state follows its key across
 * reorders, additions, and removals.
 */
import { expect, test } from "./fixtures";

/** Mount the KeyShuffleDemo into the page. */
async function mountApp(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* CounterItem({ id }: { id: string }) {
      const [count, setCount] = yield* useState(0);
      return createElement(
        "div",
        { "data-testid": `item-${id}`, "data-id": id },
        createElement("strong", null, id),
        createElement("span", { "data-testid": `count-${id}` }, String(count)),
        createElement(
          "button",
          { "data-testid": `inc-${id}`, onclick: () => setCount(count + 1) },
          "+",
        ),
      );
    }

    function* App(_: object) {
      const [order, setOrder] = yield* useState(["A", "B", "C"]);
      (window as unknown as Record<string, unknown>).__setOrder = (newOrder: string[]) =>
        setOrder(newOrder);

      return createElement(
        "div",
        null,
        createElement(
          "div",
          { "data-testid": "list" },
          ...order.map((id: string) => createElement(CounterItem as never, { $key: id, id })),
        ),
        createElement("p", { "data-testid": "order-display" }, order.join(", ")),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });
}

/** Call __setOrder from the browser context. */
async function setOrder(page: import("@playwright/test").Page, order: string[]) {
  await page.evaluate(
    (o) => (window as unknown as Record<string, (v: string[]) => void>).__setOrder(o),
    order,
  );
}

/** Click the increment button for a given key N times. */
async function incrementBy(page: import("@playwright/test").Page, id: string, times: number) {
  for (let i = 0; i < times; i++) {
    await page.getByTestId(`inc-${id}`).click();
  }
}

test("initial render shows items A, B, C in order", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  await expect(page.getByTestId("order-display")).toHaveText("A, B, C");
  await expect(page.getByTestId("count-A")).toHaveText("0");
  await expect(page.getByTestId("count-B")).toHaveText("0");
  await expect(page.getByTestId("count-C")).toHaveText("0");
});

test("reverse preserves state - A incremented to 3 keeps count after reverse", async ({
  page,
  setupPage,
}) => {
  await setupPage();
  await mountApp(page);

  await incrementBy(page, "A", 3);
  await expect(page.getByTestId("count-A")).toHaveText("3");

  await setOrder(page, ["C", "B", "A"]);

  await expect(page.getByTestId("order-display")).toHaveText("C, B, A");
  await expect(page.getByTestId("count-A")).toHaveText("3");
  await expect(page.getByTestId("count-B")).toHaveText("0");
  await expect(page.getByTestId("count-C")).toHaveText("0");
});

test("shuffle preserves all states - each count follows its key", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  await incrementBy(page, "A", 2);
  await incrementBy(page, "B", 3);
  await incrementBy(page, "C", 1);

  await expect(page.getByTestId("count-A")).toHaveText("2");
  await expect(page.getByTestId("count-B")).toHaveText("3");
  await expect(page.getByTestId("count-C")).toHaveText("1");

  // Reorder to B, C, A
  await setOrder(page, ["B", "C", "A"]);

  await expect(page.getByTestId("order-display")).toHaveText("B, C, A");
  await expect(page.getByTestId("count-A")).toHaveText("2");
  await expect(page.getByTestId("count-B")).toHaveText("3");
  await expect(page.getByTestId("count-C")).toHaveText("1");
});

test("add item to end - existing counts preserved, new item starts at 0", async ({
  page,
  setupPage,
}) => {
  await setupPage();
  await mountApp(page);

  await incrementBy(page, "A", 1);
  await incrementBy(page, "B", 2);
  await expect(page.getByTestId("count-A")).toHaveText("1");
  await expect(page.getByTestId("count-B")).toHaveText("2");

  await setOrder(page, ["A", "B", "C", "D"]);

  await expect(page.getByTestId("order-display")).toHaveText("A, B, C, D");
  await expect(page.getByTestId("count-A")).toHaveText("1");
  await expect(page.getByTestId("count-B")).toHaveText("2");
  await expect(page.getByTestId("count-C")).toHaveText("0");
  await expect(page.getByTestId("count-D")).toHaveText("0");
});

test("remove item - removed item gone, remaining states preserved", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  await incrementBy(page, "A", 4);
  await incrementBy(page, "C", 2);
  await expect(page.getByTestId("count-A")).toHaveText("4");
  await expect(page.getByTestId("count-C")).toHaveText("2");

  await setOrder(page, ["A", "C"]);

  await expect(page.getByTestId("order-display")).toHaveText("A, C");
  await expect(page.getByTestId("count-A")).toHaveText("4");
  await expect(page.getByTestId("count-C")).toHaveText("2");
  await expect(page.getByTestId("item-B")).toHaveCount(0);
});

test("remove middle item - A and C states intact, B gone", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  await incrementBy(page, "A", 1);
  await incrementBy(page, "B", 5);
  await incrementBy(page, "C", 3);

  await setOrder(page, ["A", "C"]);

  await expect(page.getByTestId("order-display")).toHaveText("A, C");
  await expect(page.getByTestId("count-A")).toHaveText("1");
  await expect(page.getByTestId("count-C")).toHaveText("3");
  await expect(page.getByTestId("item-B")).toHaveCount(0);
});

test("replace entire list - new items all start at 0", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  await incrementBy(page, "A", 2);
  await incrementBy(page, "B", 3);
  await incrementBy(page, "C", 4);

  await setOrder(page, ["D", "E", "F"]);

  await expect(page.getByTestId("order-display")).toHaveText("D, E, F");
  await expect(page.getByTestId("count-D")).toHaveText("0");
  await expect(page.getByTestId("count-E")).toHaveText("0");
  await expect(page.getByTestId("count-F")).toHaveText("0");
  await expect(page.getByTestId("item-A")).toHaveCount(0);
  await expect(page.getByTestId("item-B")).toHaveCount(0);
  await expect(page.getByTestId("item-C")).toHaveCount(0);
});

test("swap two items - states follow their keys", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  await incrementBy(page, "A", 7);
  await incrementBy(page, "B", 1);
  await expect(page.getByTestId("count-A")).toHaveText("7");
  await expect(page.getByTestId("count-B")).toHaveText("1");

  // Swap A and B, keep C in place
  await setOrder(page, ["B", "A", "C"]);

  await expect(page.getByTestId("order-display")).toHaveText("B, A, C");
  await expect(page.getByTestId("count-A")).toHaveText("7");
  await expect(page.getByTestId("count-B")).toHaveText("1");
  await expect(page.getByTestId("count-C")).toHaveText("0");
});

test("add to beginning - Z starts at 0, existing states preserved", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  await incrementBy(page, "A", 3);
  await incrementBy(page, "B", 2);
  await incrementBy(page, "C", 1);

  await setOrder(page, ["Z", "A", "B", "C"]);

  await expect(page.getByTestId("order-display")).toHaveText("Z, A, B, C");
  await expect(page.getByTestId("count-Z")).toHaveText("0");
  await expect(page.getByTestId("count-A")).toHaveText("3");
  await expect(page.getByTestId("count-B")).toHaveText("2");
  await expect(page.getByTestId("count-C")).toHaveText("1");
});

test("empty then refill - all fresh instances start at 0", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  await incrementBy(page, "A", 5);
  await incrementBy(page, "B", 3);
  await incrementBy(page, "C", 1);
  await expect(page.getByTestId("count-A")).toHaveText("5");

  // Empty the list
  await setOrder(page, []);
  await expect(page.getByTestId("order-display")).toHaveText("");
  await expect(page.getByTestId("item-A")).toHaveCount(0);
  await expect(page.getByTestId("item-B")).toHaveCount(0);
  await expect(page.getByTestId("item-C")).toHaveCount(0);

  // Refill with the same keys
  await setOrder(page, ["A", "B", "C"]);
  await expect(page.getByTestId("order-display")).toHaveText("A, B, C");
  await expect(page.getByTestId("count-A")).toHaveText("0");
  await expect(page.getByTestId("count-B")).toHaveText("0");
  await expect(page.getByTestId("count-C")).toHaveText("0");
});
