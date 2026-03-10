/**
 * E2E tests for useEffect with manual AbortController pattern:
 * components create their own AbortController in the effect,
 * return a cleanup that aborts it, and use the signal for async work.
 */
import { expect, test } from "./fixtures";

/**
 * Mounts the FetchRow demo app into the page.
 *
 * Three FetchRow components (rowId 1, 2, 3) share a single activeId.
 * The active row starts a timer (simulating async work); inactive rows
 * display "inactive". Switching the active row triggers cleanup which
 * aborts the controller, incrementing the abort count.
 *
 * Exposes `window.__setActiveId` and `window.__setShowApp` for test control.
 */
async function mountApp(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const { createElement, render, useState, useEffect, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* FetchRow({ activeId, rowId }: { activeId: number; rowId: number }) {
      const [status, setStatus] = yield* useState("idle");
      const abortCount = yield* useRef(0);

      yield* useEffect(() => {
        if (activeId !== rowId) {
          setStatus("inactive");
          return undefined;
        }
        const ctrl = new AbortController();
        setStatus("fetching");

        const timer = setTimeout(() => {
          if (!ctrl.signal.aborted) setStatus("done");
        }, 200);

        ctrl.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          abortCount.current++;
        });

        return () => ctrl.abort();
      }, [activeId]);

      return createElement(
        "div",
        { "data-testid": `row-${rowId}` },
        createElement("span", { "data-testid": `status-${rowId}` }, status),
        createElement(
          "span",
          { "data-testid": `abort-count-${rowId}` },
          String(abortCount.current),
        ),
      );
    }

    function* App() {
      const [activeId, setActiveId] = yield* useState(1);
      const [showApp, setShowApp] = yield* useState(true);
      win.__setActiveId = setActiveId;
      win.__setShowApp = setShowApp;

      if (!showApp) {
        return createElement("div", { "data-testid": "unmounted" }, "app removed");
      }

      return createElement(
        "div",
        { "data-testid": "app" },
        createElement(FetchRow as never, { activeId, rowId: 1 }),
        createElement(FetchRow as never, { activeId, rowId: 2 }),
        createElement(FetchRow as never, { activeId, rowId: 3 }),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });
}

test("initial state - active row fetches then completes", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  // Row 1 is active and should be fetching immediately
  await expect(page.getByTestId("status-1")).toHaveText("fetching");
  await expect(page.getByTestId("abort-count-1")).toHaveText("0");

  // Wait for the async work to complete (200ms timer)
  await page.waitForTimeout(300);
  await expect(page.getByTestId("status-1")).toHaveText("done");
  await expect(page.getByTestId("abort-count-1")).toHaveText("0");
});

test("switching active row aborts previous", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  // Row 1 is active and fetching
  await expect(page.getByTestId("status-1")).toHaveText("fetching");

  // Switch to row 2 before row 1 completes
  await page.evaluate(() => {
    (window as unknown as { __setActiveId: (v: number) => void }).__setActiveId(2);
  });

  // Row 2 should now be fetching
  await expect(page.getByTestId("status-2")).toHaveText("fetching");

  // Row 1's abort count should have increased (cleanup aborted its controller)
  await expect(page.getByTestId("abort-count-1")).toHaveText("1");

  // Row 1 should now be inactive (effect re-ran with new activeId)
  await expect(page.getByTestId("status-1")).toHaveText("inactive");
});

test("inactive rows show inactive", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  // Rows 2 and 3 are not active, should display "inactive"
  await expect(page.getByTestId("status-2")).toHaveText("inactive");
  await expect(page.getByTestId("status-3")).toHaveText("inactive");

  // Their abort counts should be 0 (no controller was ever created)
  await expect(page.getByTestId("abort-count-2")).toHaveText("0");
  await expect(page.getByTestId("abort-count-3")).toHaveText("0");
});

test("multiple switches accumulate abort counts", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  // Initial: row 1 active
  await expect(page.getByTestId("status-1")).toHaveText("fetching");

  // Switch 1 -> 2
  await page.evaluate(() => {
    (window as unknown as { __setActiveId: (v: number) => void }).__setActiveId(2);
  });
  await expect(page.getByTestId("status-2")).toHaveText("fetching");
  await expect(page.getByTestId("abort-count-1")).toHaveText("1");

  // Switch 2 -> 3
  await page.evaluate(() => {
    (window as unknown as { __setActiveId: (v: number) => void }).__setActiveId(3);
  });
  await expect(page.getByTestId("status-3")).toHaveText("fetching");
  await expect(page.getByTestId("abort-count-2")).toHaveText("1");

  // Row 1 still has exactly 1 abort (only aborted once when switching away)
  await expect(page.getByTestId("abort-count-1")).toHaveText("1");

  // Row 3 has 0 aborts (currently active, never been aborted)
  await expect(page.getByTestId("abort-count-3")).toHaveText("0");
});

test("rapid switching - only final active row completes", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  // Rapidly switch through rows: 1 -> 2 -> 3 -> 1 -> 2
  await page.evaluate(() => {
    const set = (window as unknown as { __setActiveId: (v: number) => void }).__setActiveId;
    set(2);
    set(3);
    set(1);
    set(2);
  });

  // After rapid switching settles, row 2 should be the active one
  await expect(page.getByTestId("status-2")).toHaveText("fetching");

  // Wait for the async work to complete
  await page.waitForTimeout(300);
  await expect(page.getByTestId("status-2")).toHaveText("done");

  // Rows 1 and 3 should be inactive
  await expect(page.getByTestId("status-1")).toHaveText("inactive");
  await expect(page.getByTestId("status-3")).toHaveText("inactive");
});

test("unmounting component aborts active controller", async ({ page, setupPage }) => {
  await setupPage();
  await mountApp(page);

  // Row 1 is active and fetching
  await expect(page.getByTestId("status-1")).toHaveText("fetching");

  // Unmount the entire app by hiding it
  await page.evaluate(() => {
    (window as unknown as { __setShowApp: (v: boolean) => void }).__setShowApp(false);
  });

  // App should be replaced with "app removed"
  await expect(page.getByTestId("unmounted")).toHaveText("app removed");

  // The FetchRow components should no longer be in the DOM
  await expect(page.getByTestId("row-1")).not.toBeAttached();
  await expect(page.getByTestId("row-2")).not.toBeAttached();
  await expect(page.getByTestId("row-3")).not.toBeAttached();
});
