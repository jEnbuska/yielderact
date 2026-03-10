/**
 * E2E tests for lazy context: useContext with selector and transform overloads.
 *
 * Tests three useContext overloads:
 * 1. No selector — rerenders on any context value change
 * 2. Selector — rerenders only when selected deps change; returns full value
 * 3. Transform — rerenders only when selected deps change; returns transformed value
 */
import { expect, test } from "./fixtures";

type AppState = { user: { name: string; role: string }; count: number };

/** Sets up the lazy context demo with three consumers and exposes __setState on window. */
async function mountLazyContextDemo(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type AppState = { user: { name: string; role: string }; count: number };

    const AppCtx = createContext<AppState>({ user: { name: "Alice", role: "admin" }, count: 0 });

    function* NoSelectorConsumer(_: object) {
      const renderCount = yield* useRef(0);
      renderCount.current++;
      const ctx = yield* useContext(AppCtx);
      return createElement(
        "div",
        { "data-testid": "no-sel" },
        createElement("span", { "data-testid": "no-sel-name" }, ctx.user.name),
        createElement("span", { "data-testid": "no-sel-count" }, String(ctx.count)),
        createElement("span", { "data-testid": "no-sel-role" }, ctx.user.role),
        createElement("span", { "data-testid": "no-sel-renders" }, String(renderCount.current)),
      );
    }

    function* SelectorConsumer(_: object) {
      const renderCount = yield* useRef(0);
      renderCount.current++;
      const ctx = yield* useContext(AppCtx, (c: AppState) => [c.user.name]);
      return createElement(
        "div",
        { "data-testid": "sel" },
        createElement("span", { "data-testid": "sel-name" }, ctx.user.name),
        createElement("span", { "data-testid": "sel-count" }, String(ctx.count)),
        createElement("span", { "data-testid": "sel-renders" }, String(renderCount.current)),
      );
    }

    function* TransformConsumer(_: object) {
      const renderCount = yield* useRef(0);
      renderCount.current++;
      const upper = yield* useContext(
        AppCtx,
        (c: AppState) => [c.user.name] as [string],
        (name: string) => name.toUpperCase(),
      );
      return createElement(
        "div",
        { "data-testid": "transform" },
        createElement("span", { "data-testid": "transform-value" }, upper),
        createElement("span", { "data-testid": "transform-renders" }, String(renderCount.current)),
      );
    }

    function* App(_: object) {
      const [state, setState] = yield* useState<AppState>({
        user: { name: "Alice", role: "admin" },
        count: 0,
      });
      (window as unknown as Record<string, unknown>).__setState = setState;
      return createElement(
        AppCtx.Provider as never,
        { value: state },
        createElement(NoSelectorConsumer as never, {}),
        createElement(SelectorConsumer as never, {}),
        createElement(TransformConsumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });
}

/** Helper to call __setState from Playwright. */
async function setState(page: import("@playwright/test").Page, value: AppState) {
  await page.evaluate((v) => {
    type AppState = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (s: AppState) => void>).__setState;
    set(v);
  }, value);
}

test("initial render: all consumers show Alice, count 0, render count 1", async ({
  page,
  setupPage,
}) => {
  await setupPage();
  await mountLazyContextDemo(page);

  // No-selector consumer
  await expect(page.getByTestId("no-sel-name")).toHaveText("Alice");
  await expect(page.getByTestId("no-sel-count")).toHaveText("0");
  await expect(page.getByTestId("no-sel-renders")).toHaveText("1");

  // Selector consumer
  await expect(page.getByTestId("sel-name")).toHaveText("Alice");
  await expect(page.getByTestId("sel-count")).toHaveText("0");
  await expect(page.getByTestId("sel-renders")).toHaveText("1");

  // Transform consumer
  await expect(page.getByTestId("transform-value")).toHaveText("ALICE");
  await expect(page.getByTestId("transform-renders")).toHaveText("1");
});

test("bump count: only no-selector rerenders", async ({ page, setupPage }) => {
  await setupPage();
  await mountLazyContextDemo(page);

  await setState(page, { user: { name: "Alice", role: "admin" }, count: 1 });

  // No-selector rerenders (render count 2), sees updated count
  await expect(page.getByTestId("no-sel-count")).toHaveText("1");
  await expect(page.getByTestId("no-sel-renders")).toHaveText("2");

  // Selector consumer does NOT rerender (name unchanged)
  await expect(page.getByTestId("sel-renders")).toHaveText("1");

  // Transform consumer does NOT rerender (name unchanged)
  await expect(page.getByTestId("transform-renders")).toHaveText("1");
});

test("change name: all three consumers rerender", async ({ page, setupPage }) => {
  await setupPage();
  await mountLazyContextDemo(page);

  await setState(page, { user: { name: "Bob", role: "admin" }, count: 0 });

  // All three rerender because name is tracked by all selectors
  await expect(page.getByTestId("no-sel-name")).toHaveText("Bob");
  await expect(page.getByTestId("no-sel-renders")).toHaveText("2");

  await expect(page.getByTestId("sel-name")).toHaveText("Bob");
  await expect(page.getByTestId("sel-renders")).toHaveText("2");

  await expect(page.getByTestId("transform-value")).toHaveText("BOB");
  await expect(page.getByTestId("transform-renders")).toHaveText("2");
});

test("change role: only no-selector rerenders", async ({ page, setupPage }) => {
  await setupPage();
  await mountLazyContextDemo(page);

  await setState(page, { user: { name: "Alice", role: "viewer" }, count: 0 });

  // No-selector rerenders on any change
  await expect(page.getByTestId("no-sel-role")).toHaveText("viewer");
  await expect(page.getByTestId("no-sel-renders")).toHaveText("2");

  // Selector tracks name only — role change does not trigger rerender
  await expect(page.getByTestId("sel-renders")).toHaveText("1");

  // Transform tracks name only — role change does not trigger rerender
  await expect(page.getByTestId("transform-renders")).toHaveText("1");
});

test("transform shows uppercase: name change from Alice to Bob shows BOB", async ({
  page,
  setupPage,
}) => {
  await setupPage();
  await mountLazyContextDemo(page);

  await expect(page.getByTestId("transform-value")).toHaveText("ALICE");

  await setState(page, { user: { name: "Bob", role: "admin" }, count: 0 });

  await expect(page.getByTestId("transform-value")).toHaveText("BOB");
  await expect(page.getByTestId("transform-renders")).toHaveText("2");
});

test("selector consumer shows stale count after bump", async ({ page, setupPage }) => {
  await setupPage();
  await mountLazyContextDemo(page);

  // Initial count is 0
  await expect(page.getByTestId("sel-count")).toHaveText("0");

  // Bump count — selector consumer does NOT rerender (name unchanged),
  // so its count display stays at 0 (stale)
  await setState(page, { user: { name: "Alice", role: "admin" }, count: 5 });

  await expect(page.getByTestId("sel-count")).toHaveText("0");
  await expect(page.getByTestId("sel-renders")).toHaveText("1");

  // Meanwhile no-selector sees the updated count
  await expect(page.getByTestId("no-sel-count")).toHaveText("5");
});

test("multiple bumps: no-selector renders 4 times, others still 1", async ({ page, setupPage }) => {
  await setupPage();
  await mountLazyContextDemo(page);

  // Bump count 3 times (name stays the same)
  await setState(page, { user: { name: "Alice", role: "admin" }, count: 1 });
  await expect(page.getByTestId("no-sel-renders")).toHaveText("2");

  await setState(page, { user: { name: "Alice", role: "admin" }, count: 2 });
  await expect(page.getByTestId("no-sel-renders")).toHaveText("3");

  await setState(page, { user: { name: "Alice", role: "admin" }, count: 3 });
  await expect(page.getByTestId("no-sel-renders")).toHaveText("4");

  // Selector and transform consumers never rerendered
  await expect(page.getByTestId("sel-renders")).toHaveText("1");
  await expect(page.getByTestId("transform-renders")).toHaveText("1");
});

test("name change after count bumps: all rerender with correct state", async ({
  page,
  setupPage,
}) => {
  await setupPage();
  await mountLazyContextDemo(page);

  // Bump count twice
  await setState(page, { user: { name: "Alice", role: "admin" }, count: 1 });
  await setState(page, { user: { name: "Alice", role: "admin" }, count: 2 });

  // no-selector has rendered 3 times; others still 1
  await expect(page.getByTestId("no-sel-renders")).toHaveText("3");
  await expect(page.getByTestId("sel-renders")).toHaveText("1");
  await expect(page.getByTestId("transform-renders")).toHaveText("1");

  // Now change name — all three rerender
  await setState(page, { user: { name: "Charlie", role: "admin" }, count: 2 });

  await expect(page.getByTestId("no-sel-name")).toHaveText("Charlie");
  await expect(page.getByTestId("no-sel-count")).toHaveText("2");
  await expect(page.getByTestId("no-sel-renders")).toHaveText("4");

  await expect(page.getByTestId("sel-name")).toHaveText("Charlie");
  await expect(page.getByTestId("sel-count")).toHaveText("2");
  await expect(page.getByTestId("sel-renders")).toHaveText("2");

  await expect(page.getByTestId("transform-value")).toHaveText("CHARLIE");
  await expect(page.getByTestId("transform-renders")).toHaveText("2");
});

test("rapid state changes: mixed bumps and name changes yield correct render counts", async ({
  page,
  setupPage,
}) => {
  await setupPage();
  await mountLazyContextDemo(page);

  // 1. Bump count (no-sel: 2, sel: 1, transform: 1)
  await setState(page, { user: { name: "Alice", role: "admin" }, count: 1 });
  await expect(page.getByTestId("no-sel-renders")).toHaveText("2");

  // 2. Change name (no-sel: 3, sel: 2, transform: 2)
  await setState(page, { user: { name: "Bob", role: "admin" }, count: 1 });
  await expect(page.getByTestId("no-sel-renders")).toHaveText("3");
  await expect(page.getByTestId("sel-renders")).toHaveText("2");
  await expect(page.getByTestId("transform-renders")).toHaveText("2");

  // 3. Bump count (no-sel: 4, sel: 2, transform: 2)
  await setState(page, { user: { name: "Bob", role: "admin" }, count: 2 });
  await expect(page.getByTestId("no-sel-renders")).toHaveText("4");
  await expect(page.getByTestId("sel-renders")).toHaveText("2");
  await expect(page.getByTestId("transform-renders")).toHaveText("2");

  // 4. Change name again (no-sel: 5, sel: 3, transform: 3)
  await setState(page, { user: { name: "Charlie", role: "admin" }, count: 2 });
  await expect(page.getByTestId("no-sel-renders")).toHaveText("5");
  await expect(page.getByTestId("sel-renders")).toHaveText("3");
  await expect(page.getByTestId("transform-renders")).toHaveText("3");

  // 5. Bump count twice more (no-sel: 7, sel: 3, transform: 3)
  await setState(page, { user: { name: "Charlie", role: "admin" }, count: 3 });
  await setState(page, { user: { name: "Charlie", role: "admin" }, count: 4 });
  await expect(page.getByTestId("no-sel-renders")).toHaveText("7");
  await expect(page.getByTestId("sel-renders")).toHaveText("3");
  await expect(page.getByTestId("transform-renders")).toHaveText("3");

  // Final values
  await expect(page.getByTestId("no-sel-name")).toHaveText("Charlie");
  await expect(page.getByTestId("no-sel-count")).toHaveText("4");
  await expect(page.getByTestId("transform-value")).toHaveText("CHARLIE");
});

test("role change does not trigger selector/transform even after name changed", async ({
  page,
  setupPage,
}) => {
  await setupPage();
  await mountLazyContextDemo(page);

  // Change name — all three rerender (no-sel: 2, sel: 2, transform: 2)
  await setState(page, { user: { name: "Diana", role: "admin" }, count: 0 });

  await expect(page.getByTestId("no-sel-name")).toHaveText("Diana");
  await expect(page.getByTestId("no-sel-renders")).toHaveText("2");
  await expect(page.getByTestId("sel-name")).toHaveText("Diana");
  await expect(page.getByTestId("sel-renders")).toHaveText("2");
  await expect(page.getByTestId("transform-value")).toHaveText("DIANA");
  await expect(page.getByTestId("transform-renders")).toHaveText("2");

  // Change role only — only no-selector rerenders (no-sel: 3, sel: 2, transform: 2)
  await setState(page, { user: { name: "Diana", role: "editor" }, count: 0 });

  await expect(page.getByTestId("no-sel-role")).toHaveText("editor");
  await expect(page.getByTestId("no-sel-renders")).toHaveText("3");

  // Selector and transform remain at render count 2
  await expect(page.getByTestId("sel-renders")).toHaveText("2");
  await expect(page.getByTestId("transform-renders")).toHaveText("2");
});
