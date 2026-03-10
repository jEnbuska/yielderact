/**
 * Visual tests for generator components: counter with state, stateless
 * components, component composition, and memoization.
 */
import { expect, test } from "./fixtures";

test("generator counter increments on click", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Counter(_: object) {
      const [count, setCount] = yield* useState(0);
      return createElement(
        "button",
        {
          id: "btn",
          onclick: () => setCount((c: number) => c + 1),
        },
        String(count),
      );
    }

    render(createElement(Counter as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#btn")).toHaveText("0");
  await page.screenshot({ path: "/tmp/visual-counter-0.png" });

  await page.click("#btn");
  await expect(page.locator("#btn")).toHaveText("1");
  await page.screenshot({ path: "/tmp/visual-counter-1.png" });

  await page.click("#btn");
  await page.click("#btn");
  await expect(page.locator("#btn")).toHaveText("3");
  await page.screenshot({ path: "/tmp/visual-counter-3.png" });
});

test("stateless generator component renders correctly", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Greeting({ name }: { name: string }) {
      return createElement("p", { id: "greeting" }, `Hello, ${name}!`);
    }

    render(
      createElement(Greeting, { name: "Playwright" }),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.locator("#greeting")).toHaveText("Hello, Playwright!");
  await page.screenshot({ path: "/tmp/visual-generator-component.png" });
});

test("generator renders child generator component", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Badge({ label }: { label: string }) {
      yield createElement("span", { id: "badge", className: "badge" }, label);
    }

    function* App() {
      yield createElement(
        "div",
        { id: "app" },
        createElement("h2", null, "App"),
        createElement(Badge as never, { label: "Active" }),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#app h2")).toHaveText("App");
  await expect(page.locator("#badge")).toHaveText("Active");
  await page.screenshot({ path: "/tmp/visual-component-in-component.png" });
});

test("parent re-render preserves child generator state (memoization)", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Child(_: object) {
      const [count, setCount] = yield* useState(0);
      (window as unknown as Record<string, () => void>).rerenderChild = () =>
        setCount((c: number) => c + 1);
      return createElement("span", { id: "child-count" }, String(count));
    }

    function* Parent(_: object) {
      const [, setTick] = yield* useState(0);
      (window as unknown as Record<string, () => void>).rerenderParent = () =>
        setTick((t: number) => t + 1);
      // Child props never change → should be memoized
      return createElement("div", null, createElement(Child as never, {}));
    }

    render(createElement(Parent as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#child-count")).toHaveText("0");

  // Increment child
  await page.evaluate(() => (window as unknown as Record<string, () => void>).rerenderChild());
  await expect(page.locator("#child-count")).toHaveText("1");

  // Re-render parent with same child props → child is memoized, stays at 1
  await page.evaluate(() => (window as unknown as Record<string, () => void>).rerenderParent());
  await expect(page.locator("#child-count")).toHaveText("1");

  await page.screenshot({ path: "/tmp/visual-memoization.png" });
});
