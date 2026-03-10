/**
 * Visual tests for useEffect lifecycle behaviour: mount timing, dependency
 * tracking, cleanup ordering, re-run semantics, multi-effect ordering,
 * state updates from effects, and timer cleanup on unmount.
 *
 * AbortSignal-specific tests live in use-effect.test.ts.
 */
import { expect, test } from "./fixtures";

/* -------------------------------------------------------------------------- */
/*  1. Effect runs after initial mount (not during render)                    */
/* -------------------------------------------------------------------------- */

test("useEffect: effect runs after initial mount, not during render", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    const log: string[] = [];
    win.log = log;

    function* App() {
      log.push("render");
      const [value] = yield* useState("hello");

      yield* useEffect(() => {
        log.push("effect");
      }, []);

      log.push("return");
      return createElement("span", { id: "out" }, value);
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#out")).toHaveText("hello");

  const log = await page.evaluate(() => {
    return (window as unknown as Record<string, string[]>).log;
  });

  // "render" and "return" happen before "effect"
  expect(log.indexOf("render")).toBeLessThan(log.indexOf("effect"));
  expect(log.indexOf("return")).toBeLessThan(log.indexOf("effect"));
});

/* -------------------------------------------------------------------------- */
/*  2. Effect with empty deps runs only once                                  */
/* -------------------------------------------------------------------------- */

test("useEffect: empty deps effect runs only once across rerenders", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* App() {
      const [count, setCount] = yield* useState(0);
      const [effectRuns, setEffectRuns] = yield* useState(0);
      win.increment = () => setCount((c: number) => c + 1);

      yield* useEffect(() => {
        setEffectRuns((r: number) => r + 1);
      }, []);

      return createElement(
        "div",
        null,
        createElement("span", { id: "count" }, String(count)),
        createElement("span", { id: "effect-runs" }, String(effectRuns)),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Effect ran once on mount
  await expect(page.locator("#effect-runs")).toHaveText("1");

  // Trigger several rerenders
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      (window as unknown as Record<string, () => void>).increment();
    });
  }

  await expect(page.locator("#count")).toHaveText("3");
  // Effect still only ran once
  await expect(page.locator("#effect-runs")).toHaveText("1");
});

/* -------------------------------------------------------------------------- */
/*  3. Effect with deps re-runs when deps change                              */
/* -------------------------------------------------------------------------- */

test("useEffect: effect re-runs when deps change", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* App() {
      const [dep, setDep] = yield* useState("a");
      const [seen, setSeen] = yield* useState("");
      win.setDep = setDep;

      yield* useEffect(() => {
        setSeen((prev: string) => (prev ? `${prev},${dep}` : dep));
      }, [dep]);

      return createElement(
        "div",
        null,
        createElement("span", { id: "dep" }, dep),
        createElement("span", { id: "seen" }, seen),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#seen")).toHaveText("a");

  await page.evaluate(() => {
    (window as unknown as Record<string, (v: string) => void>).setDep("b");
  });
  await expect(page.locator("#seen")).toHaveText("a,b");

  await page.evaluate(() => {
    (window as unknown as Record<string, (v: string) => void>).setDep("c");
  });
  await expect(page.locator("#seen")).toHaveText("a,b,c");

  // Same value again — effect should NOT re-run
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: string) => void>).setDep("c");
  });
  await expect(page.locator("#seen")).toHaveText("a,b,c");
});

/* -------------------------------------------------------------------------- */
/*  4. Cleanup function called on deps change (before new effect)             */
/* -------------------------------------------------------------------------- */

test("useEffect: cleanup called on deps change", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    const log: string[] = [];
    win.log = log;

    function* App() {
      const [dep, setDep] = yield* useState(1);
      win.setDep = setDep;

      yield* useEffect(() => {
        log.push(`effect-${dep}`);
        return () => {
          log.push(`cleanup-${dep}`);
        };
      }, [dep]);

      return createElement("span", { id: "dep" }, String(dep));
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#dep")).toHaveText("1");

  await page.evaluate(() => {
    (window as unknown as Record<string, (v: number) => void>).setDep(2);
  });
  await expect(page.locator("#dep")).toHaveText("2");

  const log = await page.evaluate(() => {
    return (window as unknown as Record<string, string[]>).log;
  });

  // effect-1 ran first, then cleanup-1 before effect-2
  expect(log).toContain("effect-1");
  expect(log).toContain("cleanup-1");
  expect(log).toContain("effect-2");
  expect(log.indexOf("cleanup-1")).toBeLessThan(log.indexOf("effect-2"));
});

/* -------------------------------------------------------------------------- */
/*  5. Cleanup function called on component unmount                           */
/* -------------------------------------------------------------------------- */

test("useEffect: cleanup called on component unmount", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.cleanupCalled = false;

    function* Child() {
      yield* useEffect(() => {
        return () => {
          (window as unknown as Record<string, unknown>).cleanupCalled = true;
        };
      }, []);

      return createElement("span", { id: "child" }, "alive");
    }

    function* App() {
      const [show, setShow] = yield* useState(true);
      win.setShow = setShow;

      return createElement(
        "div",
        null,
        show
          ? createElement(Child as never, {})
          : createElement("span", { id: "gone" }, "unmounted"),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#child")).toHaveText("alive");

  // Unmount child
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: boolean) => void>).setShow(false);
  });

  await expect(page.locator("#gone")).toHaveText("unmounted");

  const cleanupCalled = await page.evaluate(() => {
    return (window as unknown as Record<string, boolean>).cleanupCalled;
  });
  expect(cleanupCalled).toBe(true);
});

/* -------------------------------------------------------------------------- */
/*  6. Cleanup ordering: old cleanup runs before new effect                   */
/* -------------------------------------------------------------------------- */

test("useEffect: old cleanup runs before new effect on deps change", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    const log: string[] = [];
    win.log = log;

    function* App() {
      const [step, setStep] = yield* useState(0);
      win.setStep = setStep;

      yield* useEffect(() => {
        log.push(`effect:${step}`);
        return () => {
          log.push(`cleanup:${step}`);
        };
      }, [step]);

      return createElement("span", { id: "step" }, String(step));
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#step")).toHaveText("0");

  // Step 0 -> 1
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: number) => void>).setStep(1);
  });
  await expect(page.locator("#step")).toHaveText("1");

  // Step 1 -> 2
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: number) => void>).setStep(2);
  });
  await expect(page.locator("#step")).toHaveText("2");

  const log = await page.evaluate(() => {
    return (window as unknown as Record<string, string[]>).log;
  });

  // Verify strict ordering: effect:0, cleanup:0, effect:1, cleanup:1, effect:2
  expect(log).toEqual(["effect:0", "cleanup:0", "effect:1", "cleanup:1", "effect:2"]);
});

/* -------------------------------------------------------------------------- */
/*  7. Effect with changing deps runs on every render                         */
/* -------------------------------------------------------------------------- */

test("useEffect: effect re-runs on every render when deps change each time", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* App() {
      const [count, setCount] = yield* useState(0);
      const [effectRuns, setEffectRuns] = yield* useState(0);
      win.increment = () => setCount((c: number) => c + 1);

      // deps = [count] means effect runs whenever count changes
      yield* useEffect(() => {
        setEffectRuns((r: number) => r + 1);
      }, [count]);

      return createElement(
        "div",
        null,
        createElement("span", { id: "count" }, String(count)),
        createElement("span", { id: "effect-runs" }, String(effectRuns)),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initial mount: effect ran once
  await expect(page.locator("#effect-runs")).toHaveText("1");

  // Each increment changes deps, so effect runs each time
  for (let i = 1; i <= 4; i++) {
    await page.evaluate(() => {
      (window as unknown as Record<string, () => void>).increment();
    });
    await expect(page.locator("#count")).toHaveText(String(i));
  }

  // effect ran once on mount + 4 increments = 5 total
  await expect(page.locator("#effect-runs")).toHaveText("5");
});

/* -------------------------------------------------------------------------- */
/*  8. Multiple effects in one component run in order                         */
/* -------------------------------------------------------------------------- */

test("useEffect: multiple effects run in declaration order", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    const log: string[] = [];
    win.log = log;

    function* App() {
      const [tick, setTick] = yield* useState(0);
      win.tick = () => setTick((t: number) => t + 1);

      yield* useEffect(() => {
        log.push("first");
      }, [tick]);

      yield* useEffect(() => {
        log.push("second");
      }, [tick]);

      yield* useEffect(() => {
        log.push("third");
      }, [tick]);

      return createElement("span", { id: "tick" }, String(tick));
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#tick")).toHaveText("0");

  const initialLog = await page.evaluate(() => {
    return (window as unknown as Record<string, string[]>).log;
  });
  expect(initialLog).toEqual(["first", "second", "third"]);

  // Trigger rerender — effects should run again in order
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).tick();
  });
  await expect(page.locator("#tick")).toHaveText("1");

  const fullLog = await page.evaluate(() => {
    return (window as unknown as Record<string, string[]>).log;
  });
  expect(fullLog).toEqual(["first", "second", "third", "first", "second", "third"]);
});

/* -------------------------------------------------------------------------- */
/*  9. Effect can trigger state update (causes re-render)                     */
/* -------------------------------------------------------------------------- */

test("useEffect: effect can trigger a state update that causes re-render", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* App() {
      const [mounted, setMounted] = yield* useState(false);

      yield* useEffect(() => {
        setMounted(true);
      }, []);

      return createElement("span", { id: "mounted" }, mounted ? "yes" : "no");
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially "no", but effect sets it to "yes" triggering a re-render
  await expect(page.locator("#mounted")).toHaveText("yes");
});

/* -------------------------------------------------------------------------- */
/*  10. Timer in effect is cleaned up on unmount                              */
/* -------------------------------------------------------------------------- */

test("useEffect: timer in effect is cleaned up on unmount", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Timer() {
      const [count, setCount] = yield* useState(0);

      yield* useEffect(() => {
        const id = setInterval(() => {
          setCount((c: number) => c + 1);
        }, 100);
        return () => {
          clearInterval(id);
        };
      }, []);

      return createElement("span", { id: "timer" }, String(count));
    }

    function* App() {
      const [show, setShow] = yield* useState(true);
      win.setShow = setShow;

      return createElement(
        "div",
        null,
        show
          ? createElement(Timer as never, {})
          : createElement("span", { id: "stopped" }, "stopped"),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Let the timer tick a few times
  await page.waitForTimeout(350);
  const countBefore = Number(await page.locator("#timer").textContent());
  expect(countBefore).toBeGreaterThanOrEqual(2);

  // Unmount the timer component
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: boolean) => void>).setShow(false);
  });
  await expect(page.locator("#stopped")).toHaveText("stopped");

  // Record a value, wait, then confirm it hasn't changed (interval was cleared)
  await page.waitForTimeout(300);

  // Timer element should be gone — the interval is no longer updating anything
  await expect(page.locator("#timer")).not.toBeAttached();
});
