/**
 * Visual tests for AbortSignal demo pattern permutations:
 * shared activeId across rows, panel mount/unmount, rapid switching,
 * setInterval cleanup on abort, and cumulative abort counts.
 */
import { expect, test } from "./fixtures";

test("multiple rows with shared activeId: switching active user aborts previous", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* SignalRow({ userId, activeId }: { userId: number; activeId: number }) {
      const [status, setStatus] = yield* useState("idle");
      const [abortCount, setAbortCount] = yield* useState(0);

      yield* useEffect(
        (signal: AbortSignal) => {
          if (activeId !== userId) {
            setStatus("inactive");
            return;
          }
          setStatus("polling");
          signal.addEventListener(
            "abort",
            () => {
              setAbortCount((c: number) => c + 1);
              setStatus("aborted");
            },
            { once: true },
          );
        },
        [activeId],
      );

      return createElement(
        "div",
        { id: `row-${userId}` },
        createElement("span", { id: `status-${userId}` }, status),
        createElement("span", { id: `aborts-${userId}` }, String(abortCount)),
      );
    }

    function* App() {
      const [activeId, setActiveId] = yield* useState(0);
      win.setActiveId = setActiveId;

      return createElement(
        "div",
        { id: "panel" },
        createElement(SignalRow as never, { userId: 1, activeId }),
        createElement(SignalRow as never, { userId: 2, activeId }),
        createElement(SignalRow as never, { userId: 3, activeId }),
        createElement(SignalRow as never, { userId: 4, activeId }),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially no user is active (activeId=0), all rows inactive
  await expect(page.locator("#status-1")).toHaveText("inactive");
  await expect(page.locator("#status-2")).toHaveText("inactive");
  await expect(page.locator("#status-3")).toHaveText("inactive");
  await expect(page.locator("#status-4")).toHaveText("inactive");

  // Activate user 1
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(1);
  });

  await expect(page.locator("#status-1")).toHaveText("polling");
  await expect(page.locator("#status-2")).toHaveText("inactive");
  await expect(page.locator("#status-3")).toHaveText("inactive");
  await expect(page.locator("#status-4")).toHaveText("inactive");

  // Switch to user 3 — user 1 should get aborted
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(3);
  });

  await expect(page.locator("#status-3")).toHaveText("polling");
  await expect(page.locator("#status-1")).toHaveText("inactive");
  await expect(page.locator("#aborts-1")).toHaveText("1");

  // Switch to user 4 — user 3 should get aborted
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(4);
  });

  await expect(page.locator("#status-4")).toHaveText("polling");
  await expect(page.locator("#status-3")).toHaveText("inactive");
  await expect(page.locator("#aborts-3")).toHaveText("1");

  // Users 2 was never active, abort count stays 0
  await expect(page.locator("#aborts-2")).toHaveText("0");
});

test("panel unmount aborts all active signals", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    // Track abort events globally since components will unmount
    win.abortedIds = [] as number[];

    function* SignalRow({ userId, activeId }: { userId: number; activeId: number }) {
      const [status, setStatus] = yield* useState("idle");

      yield* useEffect(
        (signal: AbortSignal) => {
          if (activeId !== userId) {
            setStatus("inactive");
            return;
          }
          setStatus("polling");
          signal.addEventListener(
            "abort",
            () => {
              (window as unknown as Record<string, unknown[]>).abortedIds.push(userId);
            },
            { once: true },
          );
        },
        [activeId],
      );

      return createElement("span", { id: `panel-status-${userId}` }, status);
    }

    function* Panel() {
      // All three rows are active simultaneously (activeId matches each)
      return createElement(
        "div",
        { id: "signal-panel" },
        createElement(SignalRow as never, { userId: 1, activeId: 1 }),
        createElement(SignalRow as never, { userId: 2, activeId: 2 }),
        createElement(SignalRow as never, { userId: 3, activeId: 3 }),
      );
    }

    function* App() {
      const [showPanel, setShowPanel] = yield* useState(true);
      win.setShowPanel = setShowPanel;

      return createElement(
        "div",
        null,
        showPanel
          ? createElement(Panel as never, {})
          : createElement("span", { id: "panel-gone" }, "panel removed"),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // All three rows should be polling
  await expect(page.locator("#panel-status-1")).toHaveText("polling");
  await expect(page.locator("#panel-status-2")).toHaveText("polling");
  await expect(page.locator("#panel-status-3")).toHaveText("polling");

  // Unmount the entire panel
  await page.evaluate(() => {
    (window as unknown as { setShowPanel: (v: boolean) => void }).setShowPanel(false);
  });

  await expect(page.locator("#panel-gone")).toHaveText("panel removed");

  // Verify all three signals were aborted
  const abortedIds = await page.evaluate(
    () => (window as unknown as Record<string, number[]>).abortedIds,
  );
  expect(abortedIds.sort()).toEqual([1, 2, 3]);
});

test("panel remount starts fresh with no stale state", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* SignalRow({ userId, activeId }: { userId: number; activeId: number }) {
      const [status, setStatus] = yield* useState("idle");
      const [abortCount, setAbortCount] = yield* useState(0);

      yield* useEffect(
        (signal: AbortSignal) => {
          if (activeId !== userId) {
            setStatus("inactive");
            return;
          }
          setStatus("polling");
          signal.addEventListener(
            "abort",
            () => {
              setAbortCount((c: number) => c + 1);
              setStatus("aborted");
            },
            { once: true },
          );
        },
        [activeId],
      );

      return createElement(
        "div",
        { id: `fresh-row-${userId}` },
        createElement("span", { id: `fresh-status-${userId}` }, status),
        createElement("span", { id: `fresh-aborts-${userId}` }, String(abortCount)),
      );
    }

    function* Panel({ activeId }: { activeId: number }) {
      return createElement(
        "div",
        { id: "fresh-panel" },
        createElement(SignalRow as never, { userId: 1, activeId }),
        createElement(SignalRow as never, { userId: 2, activeId }),
      );
    }

    function* App() {
      const [showPanel, setShowPanel] = yield* useState(true);
      const [activeId, setActiveId] = yield* useState(1);
      win.setShowPanel = setShowPanel;
      win.setActiveId = setActiveId;

      return createElement(
        "div",
        null,
        showPanel
          ? createElement(Panel as never, { activeId })
          : createElement("span", { id: "fresh-gone" }, "gone"),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // User 1 is polling initially
  await expect(page.locator("#fresh-status-1")).toHaveText("polling");
  await expect(page.locator("#fresh-aborts-1")).toHaveText("0");

  // Switch active to user 2 — user 1 aborted once
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(2);
  });

  await expect(page.locator("#fresh-status-2")).toHaveText("polling");
  await expect(page.locator("#fresh-aborts-1")).toHaveText("1");

  // Unmount the panel
  await page.evaluate(() => {
    (window as unknown as { setShowPanel: (v: boolean) => void }).setShowPanel(false);
  });

  await expect(page.locator("#fresh-gone")).toHaveText("gone");

  // Reset activeId back to 1 while panel is unmounted
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(1);
  });

  // Remount the panel
  await page.evaluate(() => {
    (window as unknown as { setShowPanel: (v: boolean) => void }).setShowPanel(true);
  });

  // Fresh mount: all state should be reset — abort counts back to 0
  await expect(page.locator("#fresh-status-1")).toHaveText("polling");
  await expect(page.locator("#fresh-aborts-1")).toHaveText("0");
  await expect(page.locator("#fresh-aborts-2")).toHaveText("0");
  await expect(page.locator("#fresh-status-2")).toHaveText("inactive");
});

test("rapid user switching: only the latest user is polling", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* SignalRow({ userId, activeId }: { userId: number; activeId: number }) {
      const [status, setStatus] = yield* useState("idle");

      yield* useEffect(
        (signal: AbortSignal) => {
          if (activeId !== userId) {
            setStatus("inactive");
            return;
          }
          setStatus("polling");
          signal.addEventListener("abort", () => setStatus("aborted"), { once: true });
        },
        [activeId],
      );

      return createElement("span", { id: `rapid-status-${userId}` }, status);
    }

    function* App() {
      const [activeId, setActiveId] = yield* useState(1);
      win.setActiveId = setActiveId;

      return createElement(
        "div",
        null,
        createElement(SignalRow as never, { userId: 1, activeId }),
        createElement(SignalRow as never, { userId: 2, activeId }),
        createElement(SignalRow as never, { userId: 3, activeId }),
        createElement(SignalRow as never, { userId: 4, activeId }),
        createElement(SignalRow as never, { userId: 5, activeId }),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#rapid-status-1")).toHaveText("polling");

  // Rapidly switch through users 2, 3, 4, 5 without waiting between switches
  await page.evaluate(() => {
    const set = (window as unknown as { setActiveId: (v: number) => void }).setActiveId;
    set(2);
    set(3);
    set(4);
    set(5);
  });

  // After all rapid switches settle, only user 5 should be polling
  await expect(page.locator("#rapid-status-5")).toHaveText("polling");
  await expect(page.locator("#rapid-status-1")).toHaveText("inactive");
  await expect(page.locator("#rapid-status-2")).toHaveText("inactive");
  await expect(page.locator("#rapid-status-3")).toHaveText("inactive");
  await expect(page.locator("#rapid-status-4")).toHaveText("inactive");
});

test("AbortSignal with setInterval: interval cleaned up on abort", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.intervalTicks = 0;
    win.intervalCleared = false;

    function* IntervalRow({ active }: { active: boolean }) {
      const [ticks, setTicks] = yield* useState(0);

      yield* useEffect(
        (signal: AbortSignal) => {
          if (!active) return;

          let count = 0;
          const id = setInterval(() => {
            if (signal.aborted) return;
            count++;
            setTicks(count);
            (window as unknown as Record<string, number>).intervalTicks = count;
          }, 50);

          signal.addEventListener(
            "abort",
            () => {
              clearInterval(id);
              (window as unknown as Record<string, boolean>).intervalCleared = true;
            },
            { once: true },
          );
        },
        [active],
      );

      return createElement(
        "div",
        { id: "interval-row" },
        createElement("span", { id: "interval-ticks" }, String(ticks)),
        createElement("span", { id: "interval-active" }, String(active)),
      );
    }

    function* App() {
      const [active, setActive] = yield* useState(true);
      win.setActive = setActive;

      return createElement("div", null, createElement(IntervalRow as never, { active }));
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Wait for some ticks to accumulate
  await page.waitForTimeout(250);

  const ticksBefore = await page.evaluate(
    () => (window as unknown as Record<string, number>).intervalTicks,
  );
  expect(ticksBefore).toBeGreaterThanOrEqual(2);

  // Deactivate — this should abort the signal and clear the interval
  await page.evaluate(() => {
    (window as unknown as { setActive: (v: boolean) => void }).setActive(false);
  });

  // Verify the interval was cleared via the abort handler
  const cleared = await page.evaluate(
    () => (window as unknown as Record<string, boolean>).intervalCleared,
  );
  expect(cleared).toBe(true);

  // Record current tick count, wait, and verify no further ticks
  const ticksAtDeactivation = await page.evaluate(
    () => (window as unknown as Record<string, number>).intervalTicks,
  );

  await page.waitForTimeout(200);

  const ticksAfterWait = await page.evaluate(
    () => (window as unknown as Record<string, number>).intervalTicks,
  );
  expect(ticksAfterWait).toBe(ticksAtDeactivation);
});

test("abort count accumulates correctly across multiple switches", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* SignalRow({ userId, activeId }: { userId: number; activeId: number }) {
      const [status, setStatus] = yield* useState("idle");
      const [abortCount, setAbortCount] = yield* useState(0);

      yield* useEffect(
        (signal: AbortSignal) => {
          if (activeId !== userId) {
            setStatus("inactive");
            return;
          }
          setStatus("polling");
          signal.addEventListener(
            "abort",
            () => {
              setAbortCount((c: number) => c + 1);
              setStatus("aborted");
            },
            { once: true },
          );
        },
        [activeId],
      );

      return createElement(
        "div",
        { id: `acc-row-${userId}` },
        createElement("span", { id: `acc-status-${userId}` }, status),
        createElement("span", { id: `acc-aborts-${userId}` }, String(abortCount)),
      );
    }

    function* App() {
      const [activeId, setActiveId] = yield* useState(1);
      win.setActiveId = setActiveId;

      return createElement(
        "div",
        null,
        createElement(SignalRow as never, { userId: 1, activeId }),
        createElement(SignalRow as never, { userId: 2, activeId }),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // User 1 starts polling
  await expect(page.locator("#acc-status-1")).toHaveText("polling");
  await expect(page.locator("#acc-aborts-1")).toHaveText("0");
  await expect(page.locator("#acc-aborts-2")).toHaveText("0");

  // Switch to user 2 — user 1 gets abort #1
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(2);
  });
  await expect(page.locator("#acc-status-2")).toHaveText("polling");
  await expect(page.locator("#acc-aborts-1")).toHaveText("1");

  // Switch back to user 1 — user 2 gets abort #1, user 1 is polling again
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(1);
  });
  await expect(page.locator("#acc-status-1")).toHaveText("polling");
  await expect(page.locator("#acc-aborts-2")).toHaveText("1");

  // Switch to user 2 again — user 1 gets abort #2
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(2);
  });
  await expect(page.locator("#acc-status-2")).toHaveText("polling");
  await expect(page.locator("#acc-aborts-1")).toHaveText("2");

  // Switch to user 1 again — user 2 gets abort #2
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(1);
  });
  await expect(page.locator("#acc-status-1")).toHaveText("polling");
  await expect(page.locator("#acc-aborts-2")).toHaveText("2");

  // One more switch — user 1 gets abort #3
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(2);
  });
  await expect(page.locator("#acc-aborts-1")).toHaveText("3");
  await expect(page.locator("#acc-aborts-2")).toHaveText("2");
});
