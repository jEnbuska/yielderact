/**
 * Visual tests for the Context API: Provider, useContext with selector
 * and transform overloads, rerender suppression, and hook state preservation.
 */
import { expect, test } from "./fixtures";

test("context Provider supplies value to deeply nested consumer", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    function* ThemeDisplay() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "theme" }, theme);
    }

    function* Section() {
      yield createElement("div", null, createElement(ThemeDisplay as never, {}));
    }

    render(
      createElement(
        ThemeCtx.Provider as never,
        { value: "dark" },
        createElement(Section as never, {}),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.locator("#theme")).toHaveText("dark");
  await page.screenshot({ path: "/tmp/visual-context.png" });
});

test("useContext selector: consumer skips rerender when selected dep is unchanged", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useRef, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: "Alice", count: 0 });

    let setSt: ((v: State) => void) | null = null;

    // Consumer uses selector that tracks only `name`.
    function* Consumer() {
      const renders = yield* useRef(0);
      renders.current++;
      // Overload 2: selector only — rerender only when name changes
      const ctx = yield* useContext(Ctx, (c) => [c.name]);
      return createElement("div", { id: "consumer" }, [
        createElement("span", { id: "name" }, ctx.name),
        createElement("span", { id: "renders" }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* useState<State>({ name: "Alice", count: 0 });
      setSt = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);

    // Expose setter on window for Playwright to call
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt?.(v);
  });

  // Initial state
  await expect(page.locator("#name")).toHaveText("Alice");
  await expect(page.locator("#renders")).toHaveText("1");

  // Change only `count` — selector tracks `name`, so Consumer must NOT rerender.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: "Alice", count: 99 });
  });

  await expect(page.locator("#name")).toHaveText("Alice");
  await expect(page.locator("#renders")).toHaveText("1");

  await page.screenshot({ path: "/tmp/visual-ctx-selector-stable.png" });
});

test("useContext selector: consumer rerenders in-place (useRef preserved) when selected dep changes", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useRef, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: "Alice", count: 0 });

    let setSt: ((v: State) => void) | null = null;

    function* Consumer() {
      const renders = yield* useRef(0);
      renders.current++;
      // Selector tracks `name`. Rerender is in-place so useRef survives.
      const ctx = yield* useContext(Ctx, (c) => [c.name]);
      return createElement("div", { id: "consumer" }, [
        createElement("span", { id: "name" }, ctx.name),
        createElement("span", { id: "renders" }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* useState<State>({ name: "Alice", count: 0 });
      setSt = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt?.(v);
  });

  await expect(page.locator("#name")).toHaveText("Alice");
  await expect(page.locator("#renders")).toHaveText("1");

  // Change only `count` — selector tracks `name`, so no rerender.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: "Alice", count: 5 });
  });
  await expect(page.locator("#renders")).toHaveText("1");

  // Change `name` — dep changed → in-place rerender → useRef increments to 2.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: "Bob", count: 5 });
  });
  await expect(page.locator("#name")).toHaveText("Bob");
  await expect(page.locator("#renders")).toHaveText("2");

  await page.screenshot({ path: "/tmp/visual-ctx-selector-changed.png" });
});

test("useContext transform: suppresses rerender when dep stable; updates transform when dep changes", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useRef, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: "Alice", count: 0 });

    let setSt: ((v: State) => void) | null = null;

    function* Consumer() {
      const renders = yield* useRef(0);
      renders.current++;
      // Overload 3: selector + transform — returns uppercased name
      const upper = yield* useContext(
        Ctx,
        (c) => [c.name] as [string],
        (name) => name.toUpperCase(),
      );
      return createElement("div", { id: "consumer" }, [
        createElement("span", { id: "upper" }, upper),
        createElement("span", { id: "renders" }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* useState<State>({ name: "Alice", count: 0 });
      setSt = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt?.(v);
  });

  // Initial: ALICE, rendered once
  await expect(page.locator("#upper")).toHaveText("ALICE");
  await expect(page.locator("#renders")).toHaveText("1");

  // Change only count — selector tracks name, so rerender is suppressed.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: "Alice", count: 7 });
  });
  // Consumer skipped — render count stays at 1, value unchanged.
  await expect(page.locator("#renders")).toHaveText("1");
  await expect(page.locator("#upper")).toHaveText("ALICE");

  // Change name — dep changed → in-place rerender → useRef increments to 2, transform produces BOB.
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: "Bob", count: 7 });
  });
  await expect(page.locator("#upper")).toHaveText("BOB");
  await expect(page.locator("#renders")).toHaveText("2");

  await page.screenshot({ path: "/tmp/visual-ctx-transform.png" });
});

test("useContext no-selector vs selector: no-selector updates on any field change, selector does not", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useRef, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: "Alice", count: 0 });

    let setSt: ((v: State) => void) | null = null;

    // Overload 1: no selector — in-place rerender on every Provider value change.
    // useRef persists across rerenders so the count increments correctly.
    function* NoSelectorConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const ctx = yield* useContext(Ctx);
      return createElement("div", null, [
        createElement("span", { id: "no-sel-count" }, String(ctx.count)),
        createElement("span", { id: "no-sel-renders" }, String(renders.current)),
      ]);
    }

    // Overload 2: selector tracking `name` — stable when only count changes.
    function* SelectorConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      yield* useContext(Ctx, (c) => [c.name]);
      return createElement("span", { id: "sel-renders" }, String(renders.current));
    }

    function* App() {
      const [st, set] = yield* useState<State>({ name: "Alice", count: 0 });
      setSt = set;
      return createElement(Ctx.Provider as never, { value: st }, [
        createElement(NoSelectorConsumer as never, {}),
        createElement(SelectorConsumer as never, {}),
      ]);
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt?.(v);
  });

  await expect(page.locator("#no-sel-count")).toHaveText("0");
  await expect(page.locator("#no-sel-renders")).toHaveText("1");
  await expect(page.locator("#sel-renders")).toHaveText("1");

  // Change only `count` — no-selector consumer rerenders in-place (renders=2,
  // sees new count); selector consumer is suppressed (still at renders=1).
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ name: "Alice", count: 5 });
  });

  await expect(page.locator("#no-sel-count")).toHaveText("5");
  await expect(page.locator("#no-sel-renders")).toHaveText("2");
  await expect(page.locator("#sel-renders")).toHaveText("1");

  await page.screenshot({ path: "/tmp/visual-ctx-no-selector.png" });
});

test("useContext selector: hook state preserved when rerender suppressed", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { name: string; count: number };
    const Ctx = createContext<State>({ name: "Alice", count: 0 });

    let setCtx: ((v: State) => void) | null = null;
    let setLocal: ((v: number) => void) | null = null;

    function* Consumer() {
      yield* useContext(Ctx, (c) => [c.name]);
      const [local, sl] = yield* useState(42);
      setLocal = sl;
      return createElement("span", { id: "local" }, String(local));
    }

    function* App() {
      const [st, set] = yield* useState<State>({ name: "Alice", count: 0 });
      setCtx = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__setCtx = (v: State) => setCtx?.(v);
    (window as unknown as Record<string, unknown>).__setLocal = (v: number) => setLocal?.(v);
  });

  // Set local state to 100
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: number) => void>).__setLocal;
    set(100);
  });
  await expect(page.locator("#local")).toHaveText("100");

  // Change only count — selector suppresses rerender, local state must survive
  await page.evaluate(() => {
    type State = { name: string; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setCtx;
    set({ name: "Alice", count: 99 });
  });
  await expect(page.locator("#local")).toHaveText("100");

  await page.screenshot({ path: "/tmp/visual-ctx-hook-state-preserved.png" });
});
