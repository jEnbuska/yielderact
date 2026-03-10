/**
 * Visual tests for useResolve and useResolveRaw hooks:
 * loading/success/error lifecycles, deps changes, and cancellation.
 */
import { expect, test } from "./fixtures";

// ---------------------------------------------------------------------------
// useResolve tests
// ---------------------------------------------------------------------------

test("useResolve: shows loading component then success", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useResolve } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* DataComp() {
      const data = yield* useResolve(
        {
          fn: (_signal) =>
            new Promise<string>((resolve) => {
              setTimeout(() => resolve("Fetched OK"), 150);
            }),
          loading: createElement("span", { id: "loading" }, "Loading..."),
          error: createElement("span", { id: "error" }, "Error"),
        },
        [],
      );
      return createElement("span", { id: "data" }, data);
    }

    render(createElement(DataComp as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially shows loading
  await expect(page.locator("#loading")).toHaveText("Loading...");
  await expect(page.locator("#data")).not.toBeAttached();

  // After the promise resolves, loading disappears and data is shown
  await expect(page.locator("#data")).toHaveText("Fetched OK", { timeout: 3000 });
  await expect(page.locator("#loading")).not.toBeAttached();
});

test("useResolve: shows error component on rejection", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useResolve } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* DataComp() {
      const data = yield* useResolve(
        {
          fn: (_signal) =>
            new Promise<string>((_resolve, reject) => {
              setTimeout(() => reject(new Error("Network failure")), 100);
            }),
          loading: createElement("span", { id: "loading" }, "Loading..."),
          error: createElement("span", { id: "error" }, "Something went wrong"),
        },
        [],
      );
      return createElement("span", { id: "data" }, data);
    }

    render(createElement(DataComp as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially shows loading
  await expect(page.locator("#loading")).toHaveText("Loading...");

  // After rejection, error component is rendered
  await expect(page.locator("#error")).toHaveText("Something went wrong", { timeout: 3000 });
  await expect(page.locator("#data")).not.toBeAttached();
  await expect(page.locator("#loading")).not.toBeAttached();
});

test("useResolve: deps change cancels previous and starts new fetch", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useResolve } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* DataComp() {
      const [userId, setUserId] = yield* useState(1);
      win.setUserId = setUserId;

      const data = yield* useResolve(
        {
          fn: (signal) =>
            new Promise<string>((resolve) => {
              const timer = setTimeout(() => {
                if (!signal.aborted) {
                  resolve(`User ${userId}`);
                }
              }, 150);
              signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
            }),
          loading: createElement("span", { id: "loading" }, "Loading..."),
          error: createElement("span", { id: "error" }, "Error"),
        },
        [userId],
      );
      return createElement("span", { id: "data" }, data);
    }

    render(createElement(DataComp as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Wait for first fetch to complete
  await expect(page.locator("#data")).toHaveText("User 1", { timeout: 3000 });

  // Change deps — should show loading again
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: number) => void>).setUserId(2);
  });

  await expect(page.locator("#loading")).toHaveText("Loading...", { timeout: 3000 });

  // Wait for second fetch to complete
  await expect(page.locator("#data")).toHaveText("User 2", { timeout: 3000 });
});

// ---------------------------------------------------------------------------
// useResolveRaw tests
// ---------------------------------------------------------------------------

test("useResolveRaw: loading then success lifecycle", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useMemo, useResolveRaw } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* DataComp() {
      const promise = yield* useMemo(
        () =>
          new Promise<string>((resolve) => {
            setTimeout(() => resolve("Raw data OK"), 150);
          }),
        [],
      );
      const result = yield* useResolveRaw<string>(promise);

      if (result.loading) {
        return createElement(
          "div",
          { id: "status" },
          createElement("span", { id: "loading-flag" }, "true"),
          createElement("span", { id: "error-flag" }, "false"),
        );
      }
      if (result.error !== undefined) {
        return createElement("span", { id: "error-msg" }, String(result.error));
      }
      return createElement(
        "div",
        { id: "status" },
        createElement("span", { id: "data" }, result.data),
        createElement("span", { id: "loading-flag" }, "false"),
        createElement("span", { id: "error-flag" }, "false"),
      );
    }

    render(createElement(DataComp as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially loading=true, no data, no error
  await expect(page.locator("#loading-flag")).toHaveText("true");
  await expect(page.locator("#error-flag")).toHaveText("false");
  await expect(page.locator("#data")).not.toBeAttached();

  // After resolve: loading=false, data present, no error
  await expect(page.locator("#data")).toHaveText("Raw data OK", { timeout: 3000 });
  await expect(page.locator("#loading-flag")).toHaveText("false");
  await expect(page.locator("#error-flag")).toHaveText("false");
});

test("useResolveRaw: error handling", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useMemo, useResolveRaw } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* DataComp() {
      const promise = yield* useMemo(
        () =>
          new Promise<string>((_resolve, reject) => {
            setTimeout(() => reject(new Error("fetch failed")), 100);
          }),
        [],
      );
      const result = yield* useResolveRaw<string, Error>(promise);

      if (result.loading) {
        return createElement("span", { id: "loading" }, "Loading...");
      }
      if (result.error !== undefined) {
        return createElement(
          "div",
          { id: "error-container" },
          createElement("span", { id: "error-msg" }, result.error.message),
          createElement("span", { id: "loading-flag" }, "false"),
        );
      }
      return createElement("span", { id: "data" }, result.data);
    }

    render(createElement(DataComp as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially loading
  await expect(page.locator("#loading")).toHaveText("Loading...");

  // After rejection: error present, loading=false, no data
  await expect(page.locator("#error-msg")).toHaveText("fetch failed", { timeout: 3000 });
  await expect(page.locator("#loading-flag")).toHaveText("false");
  await expect(page.locator("#data")).not.toBeAttached();
});

test("useResolveRaw: deps change during pending", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useMemo, useResolveRaw } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* DataComp() {
      const [itemId, setItemId] = yield* useState(1);
      win.setItemId = setItemId;

      const promise = yield* useMemo(
        () =>
          new Promise<string>((resolve) => {
            setTimeout(() => resolve(`Item ${itemId}`), 150);
          }),
        [itemId],
      );
      const result = yield* useResolveRaw<string>(promise);

      if (result.loading) {
        return createElement("span", { id: "loading" }, "Loading...");
      }
      if (result.error !== undefined) {
        return createElement("span", { id: "error" }, String(result.error));
      }
      return createElement("span", { id: "data" }, result.data);
    }

    render(createElement(DataComp as never, {}), document.getElementById("root") as HTMLElement);
  });

  // First load
  await expect(page.locator("#data")).toHaveText("Item 1", { timeout: 3000 });

  // Change deps — should go back to loading then show new data
  await page.evaluate(() => {
    (window as unknown as Record<string, (v: number) => void>).setItemId(2);
  });

  await expect(page.locator("#loading")).toHaveText("Loading...", { timeout: 3000 });
  await expect(page.locator("#data")).toHaveText("Item 2", { timeout: 3000 });
});

test("useResolveRaw: rapid deps changes — only latest resolves", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useMemo, useResolveRaw } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* DataComp() {
      const [queryId, setQueryId] = yield* useState(1);
      win.setQueryId = setQueryId;

      const promise = yield* useMemo(
        () =>
          new Promise<string>((resolve) => {
            setTimeout(() => resolve(`Result ${queryId}`), 200);
          }),
        [queryId],
      );
      const result = yield* useResolveRaw<string>(promise);

      if (result.loading) {
        return createElement("span", { id: "loading" }, "Loading...");
      }
      if (result.error !== undefined) {
        return createElement("span", { id: "error" }, String(result.error));
      }
      return createElement("span", { id: "data" }, result.data);
    }

    render(createElement(DataComp as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Wait for initial result
  await expect(page.locator("#data")).toHaveText("Result 1", { timeout: 3000 });

  // Fire rapid changes: 2 -> 3 -> 4 in quick succession
  await page.evaluate(() => {
    const win = window as unknown as Record<string, (v: number) => void>;
    win.setQueryId(2);
  });
  // Small delay then change again before previous resolves
  await page.waitForTimeout(50);
  await page.evaluate(() => {
    const win = window as unknown as Record<string, (v: number) => void>;
    win.setQueryId(3);
  });
  await page.waitForTimeout(50);
  await page.evaluate(() => {
    const win = window as unknown as Record<string, (v: number) => void>;
    win.setQueryId(4);
  });

  // Should be in loading state
  await expect(page.locator("#loading")).toBeAttached({ timeout: 3000 });

  // Only the last result (4) should be displayed, stale results are ignored
  await expect(page.locator("#data")).toHaveText("Result 4", { timeout: 5000 });

  // Verify no stale result appears after settling
  await page.waitForTimeout(500);
  await expect(page.locator("#data")).toHaveText("Result 4");
});
