/**
 * Visual tests for hook interactions: useId uniqueness, useRef persistence,
 * useMemo caching/recomputation, and multi-hook combinations.
 */
import { expect, test } from "./fixtures";

test("useId generates unique IDs across multiple components", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useId } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* IdComponent({ label }: { label: string }) {
      const id = yield* useId();
      return createElement(
        "div",
        { id: `wrapper-${label}` },
        createElement("label", { htmlFor: id, id: `label-${label}` }, `${label}: ${id}`),
        createElement("input", { id: `input-${label}`, "data-id": id }),
      );
    }

    function* App() {
      return createElement(
        "div",
        { id: "app" },
        createElement(IdComponent as never, { label: "first" }),
        createElement(IdComponent as never, { label: "second" }),
        createElement(IdComponent as never, { label: "third" }),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // All three components should be rendered
  await expect(page.locator("#wrapper-first")).toBeAttached();
  await expect(page.locator("#wrapper-second")).toBeAttached();
  await expect(page.locator("#wrapper-third")).toBeAttached();

  // Extract the IDs and verify uniqueness
  const ids = await page.evaluate(() => {
    return {
      first: document.getElementById("input-first")?.getAttribute("data-id"),
      second: document.getElementById("input-second")?.getAttribute("data-id"),
      third: document.getElementById("input-third")?.getAttribute("data-id"),
    };
  });

  expect(ids.first).toBeTruthy();
  expect(ids.second).toBeTruthy();
  expect(ids.third).toBeTruthy();
  expect(ids.first).not.toBe(ids.second);
  expect(ids.first).not.toBe(ids.third);
  expect(ids.second).not.toBe(ids.third);

  // Each ID should match the :rN: pattern
  expect(ids.first).toMatch(/^:r\d+:$/);
  expect(ids.second).toMatch(/^:r\d+:$/);
  expect(ids.third).toMatch(/^:r\d+:$/);

  await page.screenshot({ path: "/tmp/visual-useId-unique.png" });
});

test("useRef persists value across rerenders without triggering rerender", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* RefComponent(_: object) {
      const [renderCount, setRenderCount] = yield* useState(0);
      const valueRef = yield* useRef(42);

      win.mutateRef = (val: number) => {
        valueRef.current = val;
      };
      win.triggerRerender = () => setRenderCount((c: number) => c + 1);

      return createElement(
        "div",
        { id: "ref-test" },
        createElement("span", { id: "render-count" }, String(renderCount)),
        createElement("span", { id: "ref-value" }, String(valueRef.current)),
      );
    }

    render(
      createElement(RefComponent as never, {}),
      document.getElementById("root") as HTMLElement,
    );
  });

  // Initial state
  await expect(page.locator("#render-count")).toHaveText("0");
  await expect(page.locator("#ref-value")).toHaveText("42");

  // Mutate the ref — should NOT cause a rerender
  await page.evaluate(() => {
    (window as unknown as Record<string, (val: number) => void>).mutateRef(100);
  });

  // Render count unchanged, ref value still shows old value (no rerender happened)
  await expect(page.locator("#render-count")).toHaveText("0");
  await expect(page.locator("#ref-value")).toHaveText("42");

  // Now trigger a rerender — ref value should be visible
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).triggerRerender();
  });

  await expect(page.locator("#render-count")).toHaveText("1");
  await expect(page.locator("#ref-value")).toHaveText("100");

  await page.screenshot({ path: "/tmp/visual-useRef-persist.png" });
});

test("useMemo recomputes only when deps change", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useMemo } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.computeCount = 0;

    function* MemoComponent(_: object) {
      const [factor, setFactor] = yield* useState(2);
      const [unrelated, setUnrelated] = yield* useState(0);

      const computed = yield* useMemo(
        (f: number) => {
          (window as unknown as Record<string, number>).computeCount++;
          return f * 10;
        },
        [factor],
      );

      win.setFactor = setFactor;
      win.setUnrelated = setUnrelated;

      return createElement(
        "div",
        { id: "memo-test" },
        createElement("span", { id: "computed" }, String(computed)),
        createElement("span", { id: "unrelated" }, String(unrelated)),
        createElement(
          "span",
          { id: "compute-count" },
          String((window as unknown as Record<string, number>).computeCount),
        ),
      );
    }

    render(
      createElement(MemoComponent as never, {}),
      document.getElementById("root") as HTMLElement,
    );
  });

  // Initial: computed = 2 * 10 = 20, compute ran once
  await expect(page.locator("#computed")).toHaveText("20");
  await expect(page.locator("#compute-count")).toHaveText("1");

  // Change unrelated state — useMemo should NOT recompute
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: number) => void>).setUnrelated(1);
  });

  await expect(page.locator("#unrelated")).toHaveText("1");
  await expect(page.locator("#computed")).toHaveText("20");
  await expect(page.locator("#compute-count")).toHaveText("1");

  // Change the dep — useMemo SHOULD recompute
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: number) => void>).setFactor(5);
  });

  await expect(page.locator("#computed")).toHaveText("50");
  await expect(page.locator("#compute-count")).toHaveText("2");

  await page.screenshot({ path: "/tmp/visual-useMemo-recompute.png" });
});

test("useMemo returns cached value when deps unchanged", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useMemo, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* CachedMemo(_: object) {
      const [tick, setTick] = yield* useState(0);
      const prevRef = yield* useRef<unknown[]>([]);

      const memoized = yield* useMemo(() => ({ stable: true }), []);

      // Track all references we've seen
      const refs = prevRef.current;
      refs.push(memoized);

      // Check if all references are the same object
      const allSame = refs.every((r) => r === refs[0]);

      win.bumpTick = () => setTick((t: number) => t + 1);

      return createElement(
        "div",
        { id: "cache-test" },
        createElement("span", { id: "tick" }, String(tick)),
        createElement("span", { id: "all-same" }, String(allSame)),
        createElement("span", { id: "ref-count" }, String(refs.length)),
      );
    }

    render(createElement(CachedMemo as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initial render
  await expect(page.locator("#tick")).toHaveText("0");
  await expect(page.locator("#all-same")).toHaveText("true");
  await expect(page.locator("#ref-count")).toHaveText("1");

  // Trigger several rerenders — memo value should remain same reference
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).bumpTick();
  });
  await expect(page.locator("#tick")).toHaveText("1");
  await expect(page.locator("#all-same")).toHaveText("true");
  await expect(page.locator("#ref-count")).toHaveText("2");

  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).bumpTick();
  });
  await expect(page.locator("#tick")).toHaveText("2");
  await expect(page.locator("#all-same")).toHaveText("true");
  await expect(page.locator("#ref-count")).toHaveText("3");

  await page.screenshot({ path: "/tmp/visual-useMemo-cached.png" });
});

test("multiple hooks in one component work correctly", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useRef, useMemo, useId } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* MultiHook(_: object) {
      const id = yield* useId();
      const [count, setCount] = yield* useState(0);
      const renderCountRef = yield* useRef(0);
      const doubled = yield* useMemo((c: number) => c * 2, [count]);

      renderCountRef.current++;
      win.increment = () => setCount((c: number) => c + 1);

      return createElement(
        "div",
        { id: "multi-hook" },
        createElement("span", { id: "hook-id" }, id),
        createElement("span", { id: "hook-count" }, String(count)),
        createElement("span", { id: "hook-doubled" }, String(doubled)),
        createElement("span", { id: "hook-renders" }, String(renderCountRef.current)),
      );
    }

    render(createElement(MultiHook as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initial state
  const id = await page.locator("#hook-id").textContent();
  expect(id).toMatch(/^:r\d+:$/);
  await expect(page.locator("#hook-count")).toHaveText("0");
  await expect(page.locator("#hook-doubled")).toHaveText("0");
  await expect(page.locator("#hook-renders")).toHaveText("1");

  // Increment
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).increment();
  });

  // ID should remain stable
  await expect(page.locator("#hook-id")).toHaveText(id as string);
  await expect(page.locator("#hook-count")).toHaveText("1");
  await expect(page.locator("#hook-doubled")).toHaveText("2");
  await expect(page.locator("#hook-renders")).toHaveText("2");

  // Increment again
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).increment();
  });

  await expect(page.locator("#hook-id")).toHaveText(id as string);
  await expect(page.locator("#hook-count")).toHaveText("2");
  await expect(page.locator("#hook-doubled")).toHaveText("4");
  await expect(page.locator("#hook-renders")).toHaveText("3");

  await page.screenshot({ path: "/tmp/visual-multi-hook.png" });
});

test("useRef + useState: ref survives state-triggered rerenders", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* RefAndState(_: object) {
      const [count, setCount] = yield* useState(0);
      const historyRef = yield* useRef<number[]>([]);

      // Record each count value seen during render
      historyRef.current.push(count);

      win.increment = () => setCount((c: number) => c + 1);

      return createElement(
        "div",
        { id: "ref-state" },
        createElement("span", { id: "rs-count" }, String(count)),
        createElement("span", { id: "rs-history" }, historyRef.current.join(",")),
        createElement("span", { id: "rs-history-len" }, String(historyRef.current.length)),
      );
    }

    render(createElement(RefAndState as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initial
  await expect(page.locator("#rs-count")).toHaveText("0");
  await expect(page.locator("#rs-history")).toHaveText("0");
  await expect(page.locator("#rs-history-len")).toHaveText("1");

  // Increment twice
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).increment();
  });
  await expect(page.locator("#rs-count")).toHaveText("1");
  await expect(page.locator("#rs-history")).toHaveText("0,1");
  await expect(page.locator("#rs-history-len")).toHaveText("2");

  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).increment();
  });
  await expect(page.locator("#rs-count")).toHaveText("2");
  await expect(page.locator("#rs-history")).toHaveText("0,1,2");
  await expect(page.locator("#rs-history-len")).toHaveText("3");

  await page.screenshot({ path: "/tmp/visual-useRef-useState.png" });
});

test("useMemo with complex dependency (object identity)", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useMemo } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.memoRunCount = 0;

    // A stable object reference held outside the component
    const stableObj = { x: 1 };

    function* ObjectDepMemo(_: object) {
      const [dep, setDep] = yield* useState(stableObj);
      const [tick, setTick] = yield* useState(0);

      const description = yield* useMemo(
        (d: { x: number }) => {
          (window as unknown as Record<string, number>).memoRunCount++;
          return `x=${d.x}`;
        },
        [dep],
      );

      win.setDep = setDep;
      win.setTick = setTick;

      return createElement(
        "div",
        { id: "obj-dep" },
        createElement("span", { id: "od-desc" }, description),
        createElement("span", { id: "od-tick" }, String(tick)),
        createElement(
          "span",
          { id: "od-memo-runs" },
          String((window as unknown as Record<string, number>).memoRunCount),
        ),
      );
    }

    render(
      createElement(ObjectDepMemo as never, {}),
      document.getElementById("root") as HTMLElement,
    );
  });

  // Initial
  await expect(page.locator("#od-desc")).toHaveText("x=1");
  await expect(page.locator("#od-memo-runs")).toHaveText("1");

  // Re-render with unrelated state change — same dep reference, memo should NOT recompute
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: number) => void>).setTick(1);
  });
  await expect(page.locator("#od-tick")).toHaveText("1");
  await expect(page.locator("#od-memo-runs")).toHaveText("1");

  // Set dep to a NEW object with same content — different identity, memo SHOULD recompute
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: { x: number }) => void>).setDep({ x: 1 });
  });
  await expect(page.locator("#od-desc")).toHaveText("x=1");
  await expect(page.locator("#od-memo-runs")).toHaveText("2");

  // Set dep to an object with different content — memo SHOULD recompute
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: { x: number }) => void>).setDep({ x: 99 });
  });
  await expect(page.locator("#od-desc")).toHaveText("x=99");
  await expect(page.locator("#od-memo-runs")).toHaveText("3");

  await page.screenshot({ path: "/tmp/visual-useMemo-object-dep.png" });
});

test("render count tracking with useRef verifies memoization prevents extra renders", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useRef, useMemo } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Child({ value }: { value: number }) {
      const renderCountRef = yield* useRef(0);
      renderCountRef.current++;

      const expensive = yield* useMemo((v: number) => `result-${v}`, [value]);

      return createElement(
        "div",
        { id: "child" },
        createElement("span", { id: "child-value" }, expensive),
        createElement("span", { id: "child-renders" }, String(renderCountRef.current)),
      );
    }

    function* Parent(_: object) {
      const [childProp, setChildProp] = yield* useState(1);
      const [parentOnly, setParentOnly] = yield* useState(0);
      const parentRenderRef = yield* useRef(0);
      parentRenderRef.current++;

      win.setChildProp = setChildProp;
      win.setParentOnly = setParentOnly;

      return createElement(
        "div",
        { id: "parent" },
        createElement("span", { id: "parent-renders" }, String(parentRenderRef.current)),
        createElement("span", { id: "parent-only" }, String(parentOnly)),
        createElement(Child as never, { value: childProp }),
      );
    }

    render(createElement(Parent as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initial state
  await expect(page.locator("#parent-renders")).toHaveText("1");
  await expect(page.locator("#child-renders")).toHaveText("1");
  await expect(page.locator("#child-value")).toHaveText("result-1");

  // Change parent-only state — parent rerenders, child is memoized (same props)
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: number) => void>).setParentOnly(1);
  });
  await expect(page.locator("#parent-only")).toHaveText("1");
  await expect(page.locator("#parent-renders")).toHaveText("2");
  // Child should NOT rerender — same props passed
  await expect(page.locator("#child-renders")).toHaveText("1");
  await expect(page.locator("#child-value")).toHaveText("result-1");

  // Change parent-only again
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: number) => void>).setParentOnly(2);
  });
  await expect(page.locator("#parent-renders")).toHaveText("3");
  await expect(page.locator("#child-renders")).toHaveText("1");

  // Now change the child prop — child SHOULD rerender
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: number) => void>).setChildProp(42);
  });
  await expect(page.locator("#parent-renders")).toHaveText("4");
  await expect(page.locator("#child-renders")).toHaveText("2");
  await expect(page.locator("#child-value")).toHaveText("result-42");

  await page.screenshot({ path: "/tmp/visual-render-count-memoization.png" });
});
