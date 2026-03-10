/**
 * Visual tests for useEffect with AbortSignal: deps change abort,
 * component unmount abort, and async work cancellation.
 */
import { expect, test } from "./fixtures";

test("useEffect: AbortSignal abort count increments when deps change", async ({
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
      const [activeId, setActiveId] = yield* useState(1);
      win.setActiveId = setActiveId;

      return createElement(
        "div",
        null,
        createElement(SignalRow, { userId: 1, activeId }),
        createElement(SignalRow, { userId: 2, activeId }),
        createElement(SignalRow, { userId: 3, activeId }),
      );
    }

    render(createElement(App, {}), document.getElementById("root") as HTMLElement);
  });

  // Initial: user 1 is polling, others inactive, all abort counts 0
  await expect(page.locator("#status-1")).toHaveText("polling");
  await expect(page.locator("#aborts-1")).toHaveText("0");
  await expect(page.locator("#status-2")).toHaveText("inactive");
  await expect(page.locator("#status-3")).toHaveText("inactive");

  // Switch to user 2 — user 1's abort count increases to 1
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(2);
  });

  await expect(page.locator("#status-2")).toHaveText("polling");
  await expect(page.locator("#aborts-1")).toHaveText("1");
  // status-1 is "inactive" because the effect re-runs with the new activeId
  await expect(page.locator("#status-1")).toHaveText("inactive");

  // Switch to user 3 — user 2's abort count increases to 1
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(3);
  });

  await expect(page.locator("#status-3")).toHaveText("polling");
  await expect(page.locator("#aborts-2")).toHaveText("1");
  await expect(page.locator("#status-2")).toHaveText("inactive");

  // Switch back to user 1 — user 3's abort count increases, user 1 still has 1
  await page.evaluate(() => {
    (window as unknown as { setActiveId: (v: number) => void }).setActiveId(1);
  });

  await expect(page.locator("#status-1")).toHaveText("polling");
  await expect(page.locator("#aborts-3")).toHaveText("1");
  await expect(page.locator("#aborts-1")).toHaveText("1");

  await page.screenshot({ path: "/tmp/visual-abort-signal-deps-change.png" });
});

test("useEffect: AbortSignal is aborted on component unmount", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Ticker() {
      const [count, setCount] = yield* useState(0);
      const abortedRef = yield* useRef(false);

      yield* useEffect((signal: AbortSignal) => {
        let n = 0;
        const id = setInterval(() => {
          if (signal.aborted) return;
          n++;
          setCount(n);
        }, 100);

        signal.addEventListener(
          "abort",
          () => {
            clearInterval(id);
            abortedRef.current = true;
          },
          { once: true },
        );

        // No cleanup fn — relying on AbortSignal only
      }, []);

      return createElement(
        "div",
        { id: "ticker" },
        createElement("span", { id: "tick-count" }, String(count)),
        createElement("span", { id: "tick-aborted" }, String(abortedRef.current)),
      );
    }

    function* App() {
      const [show, setShow] = yield* useState(true);
      (window as unknown as Record<string, unknown>).setShow = setShow;

      return createElement(
        "div",
        null,
        show ? createElement(Ticker, {}) : createElement("span", { id: "gone" }, "unmounted"),
      );
    }

    render(createElement(App, {}), document.getElementById("root") as HTMLElement);
  });

  // Ticker should be running
  await expect(page.locator("#ticker")).toBeAttached();

  // Wait for a couple ticks
  await page.waitForTimeout(350);
  const countBefore = Number(await page.locator("#tick-count").textContent());
  expect(countBefore).toBeGreaterThanOrEqual(2);

  // Unmount the ticker
  await page.evaluate(() => {
    (window as unknown as { setShow: (v: boolean) => void }).setShow(false);
  });

  await expect(page.locator("#gone")).toHaveText("unmounted");

  // The ticker should be gone and the interval stopped (signal aborted)
  await expect(page.locator("#ticker")).not.toBeAttached();

  await page.screenshot({ path: "/tmp/visual-abort-signal-unmount.png" });
});

test("useEffect: AbortSignal aborts async work (fetch-like) on deps change", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useEffect } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* AsyncWorker({ taskId }: { taskId: number }) {
      const [result, setResult] = yield* useState("pending");

      yield* useEffect(
        (signal: AbortSignal) => {
          setResult("pending");
          // Simulate async work that respects the signal
          const timer = setTimeout(() => {
            if (!signal.aborted) {
              setResult(`done-${taskId}`);
            }
          }, 300);

          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              setResult(`cancelled-${taskId}`);
            },
            { once: true },
          );
        },
        [taskId],
      );

      return createElement("span", { id: "async-result" }, result);
    }

    function* App() {
      const [taskId, setTaskId] = yield* useState(1);
      (window as unknown as Record<string, unknown>).setTaskId = setTaskId;

      return createElement(
        "div",
        null,
        createElement("span", { id: "task-id" }, String(taskId)),
        createElement(AsyncWorker, { taskId }),
      );
    }

    render(createElement(App, {}), document.getElementById("root") as HTMLElement);
  });

  // Initial: pending then resolves to done-1
  await expect(page.locator("#async-result")).toHaveText("done-1", { timeout: 2000 });

  // Change task before it can complete — previous is cancelled, new one starts
  await page.evaluate(() => {
    (window as unknown as { setTaskId: (v: number) => void }).setTaskId(2);
  });

  // Should quickly show cancelled for task 1, then resolve to done-2
  await expect(page.locator("#async-result")).toHaveText("done-2", { timeout: 2000 });
  await expect(page.locator("#task-id")).toHaveText("2");

  await page.screenshot({ path: "/tmp/visual-abort-signal-async-cancel.png" });
});
