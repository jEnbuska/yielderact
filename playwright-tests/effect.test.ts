/**
 * E2E tests for useEffect: cleanup, dependency tracking, and lifecycle.
 */
import { expect, test } from "./fixtures";

test("effect runs after mount", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.__log = [];

    function* App() {
      yield* useEffect(() => {
        (window as unknown as { __log: string[] }).__log.push("mount-effect");
      }, []);

      return createElement("div", { id: "app" }, "mounted");
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#app")).toHaveText("mounted");
  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log).toEqual(["mount-effect"]);
});

test("effect cleanup runs on unmount", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.__log = [];

    function* Child() {
      yield* useEffect(() => {
        (window as unknown as { __log: string[] }).__log.push("child-mount");
        return () => {
          (window as unknown as { __log: string[] }).__log.push("child-cleanup");
        };
      }, []);

      return createElement("div", { id: "child" }, "child");
    }

    function* App() {
      const [show, setShow] = yield* useState(true);
      (window as unknown as Record<string, unknown>).setShow = setShow;

      return createElement(
        "div",
        { id: "app" },
        show
          ? createElement(Child as never, {})
          : createElement("span", { id: "gone" }, "unmounted"),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#child")).toHaveText("child");
  const logBefore = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(logBefore).toEqual(["child-mount"]);

  // Hide child via conditional rendering
  await page.evaluate(() => {
    (window as unknown as { setShow: (v: boolean) => void }).setShow(false);
  });

  await expect(page.locator("#gone")).toHaveText("unmounted");
  const logAfter = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(logAfter).toEqual(["child-mount", "child-cleanup"]);
});

test("effect re-runs when deps change", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.__log = [];

    function* App() {
      const [dep, setDep] = yield* useState(1);
      (window as unknown as Record<string, unknown>).setDep = setDep;

      yield* useEffect(() => {
        (window as unknown as { __log: string[] }).__log.push(`effect-${dep}`);
        return () => {
          (window as unknown as { __log: string[] }).__log.push(`cleanup-${dep}`);
        };
      }, [dep]);

      return createElement("div", { id: "val" }, String(dep));
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#val")).toHaveText("1");
  const log1 = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log1).toEqual(["effect-1"]);

  // Change dep to 2
  await page.evaluate(() => {
    (window as unknown as { setDep: (v: number) => void }).setDep(2);
  });

  await expect(page.locator("#val")).toHaveText("2");
  const log2 = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log2).toEqual(["effect-1", "cleanup-1", "effect-2"]);
});

test("multiple effects run in declaration order", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.__log = [];

    function* App() {
      yield* useEffect(() => {
        (window as unknown as { __log: string[] }).__log.push("effect-A");
      }, []);

      yield* useEffect(() => {
        (window as unknown as { __log: string[] }).__log.push("effect-B");
      }, []);

      return createElement("div", { id: "app" }, "ready");
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#app")).toHaveText("ready");
  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log).toEqual(["effect-A", "effect-B"]);
});

test("cleanup order on deps change: old cleanup runs before new effect", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.__log = [];

    function* App() {
      const [dep, setDep] = yield* useState("a");
      (window as unknown as Record<string, unknown>).setDep = setDep;

      yield* useEffect(() => {
        (window as unknown as { __log: string[] }).__log.push(`effect-${dep}`);
        return () => {
          (window as unknown as { __log: string[] }).__log.push(`cleanup-${dep}`);
        };
      }, [dep]);

      return createElement("div", { id: "val" }, dep);
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#val")).toHaveText("a");

  await page.evaluate(() => {
    (window as unknown as { setDep: (v: string) => void }).setDep("b");
  });

  await expect(page.locator("#val")).toHaveText("b");

  await page.evaluate(() => {
    (window as unknown as { setDep: (v: string) => void }).setDep("c");
  });

  await expect(page.locator("#val")).toHaveText("c");

  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  // Each transition: old cleanup fires, then new effect
  expect(log).toEqual(["effect-a", "cleanup-a", "effect-b", "cleanup-b", "effect-c"]);
});

test("timer effect with cleanup: setInterval cleared on unmount", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Timer() {
      const [count, setCount] = yield* useState(0);

      yield* useEffect(() => {
        const id = setInterval(() => {
          setCount((c: number) => c + 1);
        }, 50);
        return () => {
          clearInterval(id);
        };
      }, []);

      return createElement("span", { id: "tick" }, String(count));
    }

    function* App() {
      const [show, setShow] = yield* useState(true);
      (window as unknown as Record<string, unknown>).setShow = setShow;

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

  // Wait for a few ticks
  await page.waitForTimeout(200);
  const countBefore = Number(await page.locator("#tick").textContent());
  expect(countBefore).toBeGreaterThanOrEqual(2);

  // Unmount the timer
  await page.evaluate(() => {
    (window as unknown as { setShow: (v: boolean) => void }).setShow(false);
  });

  await expect(page.locator("#stopped")).toHaveText("stopped");

  // Record the moment of unmount, wait, and confirm no further increments
  await page.waitForTimeout(200);
  // Timer element is gone, interval should be cleared
  await expect(page.locator("#tick")).not.toBeAttached();
});

test("effect with ref does not cause extra renders", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useEffect, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.__renderCount = 0;

    function* App() {
      (window as unknown as { __renderCount: number }).__renderCount++;
      const renderCountRef = yield* useRef(0);

      yield* useEffect(() => {
        // Mutating ref.current should NOT trigger a rerender
        renderCountRef.current = 42;
      }, []);

      return createElement(
        "div",
        { id: "app" },
        `renders: ${(window as unknown as { __renderCount: number }).__renderCount}`,
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#app")).toHaveText("renders: 1");

  // Wait a bit to ensure no surprise rerenders
  await page.waitForTimeout(100);
  await expect(page.locator("#app")).toHaveText("renders: 1");

  const renderCount = await page.evaluate(
    () => (window as unknown as { __renderCount: number }).__renderCount,
  );
  expect(renderCount).toBe(1);
});

test("rapid dep changes settle to correct final state", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.__log = [];

    function* App() {
      const [dep, setDep] = yield* useState(0);
      (window as unknown as Record<string, unknown>).setDep = setDep;

      yield* useEffect(() => {
        (window as unknown as { __log: string[] }).__log.push(`effect-${dep}`);
        return () => {
          (window as unknown as { __log: string[] }).__log.push(`cleanup-${dep}`);
        };
      }, [dep]);

      return createElement("div", { id: "val" }, String(dep));
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#val")).toHaveText("0");

  // Rapidly change dep multiple times
  await page.evaluate(() => {
    const set = (window as unknown as { setDep: (v: number) => void }).setDep;
    set(1);
    set(2);
    set(3);
    set(4);
    set(5);
  });

  await expect(page.locator("#val")).toHaveText("5");

  // The final log should end with effect-5
  const log: string[] = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log[0]).toBe("effect-0");
  expect(log[log.length - 1]).toBe("effect-5");
});

test("effect skipped when deps unchanged on parent rerender", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.__log = [];

    function* Child() {
      yield* useEffect(() => {
        (window as unknown as { __log: string[] }).__log.push("child-effect");
      }, []);

      return createElement("span", { id: "child" }, "child");
    }

    function* Parent() {
      const [tick, setTick] = yield* useState(0);
      (window as unknown as Record<string, unknown>).setTick = setTick;

      return createElement(
        "div",
        null,
        createElement("span", { id: "tick" }, String(tick)),
        createElement(Child as never, {}),
      );
    }

    render(createElement(Parent as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#child")).toHaveText("child");
  const log1 = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log1).toEqual(["child-effect"]);

  // Rerender parent -- child's empty-deps effect should NOT re-run
  await page.evaluate(() => {
    (window as unknown as { setTick: (fn: (t: number) => number) => void }).setTick(
      (t: number) => t + 1,
    );
  });

  await expect(page.locator("#tick")).toHaveText("1");
  const log2 = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log2).toEqual(["child-effect"]);

  // Rerender parent again
  await page.evaluate(() => {
    (window as unknown as { setTick: (fn: (t: number) => number) => void }).setTick(
      (t: number) => t + 1,
    );
  });

  await expect(page.locator("#tick")).toHaveText("2");
  const log3 = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  // Still only the initial mount effect
  expect(log3).toEqual(["child-effect"]);
});

test("multiple effects with different deps: changing x re-runs only effect A", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.__log = [];

    function* App() {
      const [x, setX] = yield* useState(0);
      const [y, setY] = yield* useState(0);
      (window as unknown as Record<string, unknown>).setX = setX;
      (window as unknown as Record<string, unknown>).setY = setY;

      yield* useEffect(() => {
        (window as unknown as { __log: string[] }).__log.push(`A-effect-${x}`);
        return () => {
          (window as unknown as { __log: string[] }).__log.push(`A-cleanup-${x}`);
        };
      }, [x]);

      yield* useEffect(() => {
        (window as unknown as { __log: string[] }).__log.push(`B-effect-${y}`);
        return () => {
          (window as unknown as { __log: string[] }).__log.push(`B-cleanup-${y}`);
        };
      }, [y]);

      return createElement(
        "div",
        null,
        createElement("span", { id: "x-val" }, String(x)),
        createElement("span", { id: "y-val" }, String(y)),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#x-val")).toHaveText("0");
  await expect(page.locator("#y-val")).toHaveText("0");
  const log1 = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log1).toEqual(["A-effect-0", "B-effect-0"]);

  // Change x only -- only effect A should re-run
  await page.evaluate(() => {
    (window as unknown as { setX: (v: number) => void }).setX(1);
  });

  await expect(page.locator("#x-val")).toHaveText("1");
  const log2 = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log2).toEqual(["A-effect-0", "B-effect-0", "A-cleanup-0", "A-effect-1"]);

  // Change y only -- only effect B should re-run
  await page.evaluate(() => {
    (window as unknown as { setY: (v: number) => void }).setY(1);
  });

  await expect(page.locator("#y-val")).toHaveText("1");
  const log3 = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  expect(log3).toEqual([
    "A-effect-0",
    "B-effect-0",
    "A-cleanup-0",
    "A-effect-1",
    "B-cleanup-0",
    "B-effect-1",
  ]);
});
