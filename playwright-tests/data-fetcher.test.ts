/**
 * Visual tests for useResolve (DataFetcher) and useResolveRaw (ResolveRawDemo).
 *
 * Covers: loading/data transitions, error states, pending/resolved/rejected
 * transitions, dep changes restarting fetch, rapid id changes, and AbortSignal
 * abort on deps change.
 */
import { expect, test } from "./fixtures";

test("useResolve: shows loading then data after resolve", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useResolve } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* DataLoader(_: object) {
      const data = yield* useResolve(
        {
          fn: () =>
            new Promise<{ name: string }>((resolve) =>
              setTimeout(() => resolve({ name: "Alice" }), 200),
            ),
          loading: createElement("p", { "data-testid": "loading" }, "Loading..."),
          error: createElement("p", { "data-testid": "error" }, "Error!"),
        },
        [],
      );
      return createElement("p", { "data-testid": "data" }, data.name);
    }

    render(createElement(DataLoader as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Loading state should appear immediately
  await expect(page.locator('[data-testid="loading"]')).toHaveText("Loading...");
  await expect(page.locator('[data-testid="data"]')).not.toBeAttached();

  // After the promise resolves, data should appear
  await expect(page.locator('[data-testid="data"]')).toHaveText("Alice", { timeout: 3000 });
  await expect(page.locator('[data-testid="loading"]')).not.toBeAttached();
});

test("useResolve: error state shown on rejection", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useResolve } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* DataLoader(_: object) {
      const data = yield* useResolve<string>(
        {
          fn: () =>
            new Promise<string>((_resolve, reject) =>
              setTimeout(() => reject(new Error("network failure")), 150),
            ),
          loading: createElement("p", { "data-testid": "loading" }, "Loading..."),
          error: createElement("p", { "data-testid": "error" }, "Error!"),
        },
        [],
      );
      return createElement("p", { "data-testid": "data" }, data);
    }

    render(createElement(DataLoader as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Loading state should appear immediately
  await expect(page.locator('[data-testid="loading"]')).toHaveText("Loading...");

  // After rejection, error state should appear
  await expect(page.locator('[data-testid="error"]')).toHaveText("Error!", { timeout: 3000 });
  await expect(page.locator('[data-testid="data"]')).not.toBeAttached();
  await expect(page.locator('[data-testid="loading"]')).not.toBeAttached();
});

test("useResolveRaw: pending to resolved transition", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useMemo, useResolveRaw } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* RawLoader(_: object) {
      const promise = yield* useMemo(
        () =>
          new Promise<{ title: string }>((resolve) =>
            setTimeout(() => resolve({ title: "Post 1" }), 200),
          ),
        [],
      );
      const result = yield* useResolveRaw<{ title: string }>(promise);

      if (result.loading) {
        return createElement("p", { "data-testid": "status" }, "pending");
      }
      if (result.error !== undefined) {
        return createElement("p", { "data-testid": "status" }, "rejected");
      }
      return createElement("p", { "data-testid": "status" }, `resolved:${result.data.title}`);
    }

    render(createElement(RawLoader as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially pending
  await expect(page.locator('[data-testid="status"]')).toHaveText("pending");

  // After resolve, shows data
  await expect(page.locator('[data-testid="status"]')).toHaveText("resolved:Post 1", {
    timeout: 3000,
  });
});

test("useResolveRaw: pending to rejected transition", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useMemo, useResolveRaw } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* RawLoader(_: object) {
      const promise = yield* useMemo(
        () =>
          new Promise<string>((_resolve, reject) =>
            setTimeout(() => reject(new Error("bad request")), 150),
          ),
        [],
      );
      const result = yield* useResolveRaw<string, Error>(promise);

      if (result.loading) {
        return createElement("p", { "data-testid": "status" }, "pending");
      }
      if (result.error !== undefined) {
        return createElement("p", { "data-testid": "status" }, `rejected:${result.error.message}`);
      }
      return createElement("p", { "data-testid": "status" }, `resolved:${result.data}`);
    }

    render(createElement(RawLoader as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially pending
  await expect(page.locator('[data-testid="status"]')).toHaveText("pending");

  // After rejection, shows error
  await expect(page.locator('[data-testid="status"]')).toHaveText("rejected:bad request", {
    timeout: 3000,
  });
});

test("useResolveRaw: changing deps restarts fetch (pending again)", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useMemo, useResolveRaw } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* RawLoader(_: object) {
      const [id, setId] = yield* useState(1);
      win.setId = setId;

      const promise = yield* useMemo(
        () => new Promise<string>((resolve) => setTimeout(() => resolve(`Post ${id}`), 200)),
        [id],
      );
      const result = yield* useResolveRaw<string>(promise);

      if (result.loading) {
        return createElement(
          "div",
          null,
          createElement("p", { "data-testid": "status" }, "pending"),
          createElement("p", { "data-testid": "id" }, String(id)),
        );
      }
      if (result.error !== undefined) {
        return createElement("p", { "data-testid": "status" }, "rejected");
      }
      return createElement(
        "div",
        null,
        createElement("p", { "data-testid": "status" }, `resolved:${result.data}`),
        createElement("p", { "data-testid": "id" }, String(id)),
      );
    }

    render(createElement(RawLoader as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially pending for id=1
  await expect(page.locator('[data-testid="status"]')).toHaveText("pending");
  await expect(page.locator('[data-testid="id"]')).toHaveText("1");

  // Wait for id=1 to resolve
  await expect(page.locator('[data-testid="status"]')).toHaveText("resolved:Post 1", {
    timeout: 3000,
  });

  // Change id to 2 — should go back to pending
  await page.evaluate(() => {
    (window as unknown as { setId: (v: number) => void }).setId(2);
  });

  await expect(page.locator('[data-testid="status"]')).toHaveText("pending");
  await expect(page.locator('[data-testid="id"]')).toHaveText("2");

  // Wait for id=2 to resolve
  await expect(page.locator('[data-testid="status"]')).toHaveText("resolved:Post 2", {
    timeout: 3000,
  });
});

test("useResolveRaw: rapid id changes - only latest resolves", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useMemo, useResolveRaw } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* RawLoader(_: object) {
      const [id, setId] = yield* useState(1);
      win.setId = setId;

      const promise = yield* useMemo(
        () => new Promise<string>((resolve) => setTimeout(() => resolve(`Result ${id}`), 300)),
        [id],
      );
      const result = yield* useResolveRaw<string>(promise);

      if (result.loading) {
        return createElement(
          "div",
          null,
          createElement("p", { "data-testid": "status" }, "pending"),
          createElement("p", { "data-testid": "id" }, String(id)),
        );
      }
      return createElement(
        "div",
        null,
        createElement("p", { "data-testid": "status" }, `resolved:${result.data}`),
        createElement("p", { "data-testid": "id" }, String(id)),
      );
    }

    render(createElement(RawLoader as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially pending
  await expect(page.locator('[data-testid="status"]')).toHaveText("pending");

  // Rapidly change id: 1 -> 2 -> 3 -> 4 before any promise resolves
  await page.evaluate(() => {
    const win = window as unknown as { setId: (v: number) => void };
    win.setId(2);
  });
  await page.waitForTimeout(50);
  await page.evaluate(() => {
    const win = window as unknown as { setId: (v: number) => void };
    win.setId(3);
  });
  await page.waitForTimeout(50);
  await page.evaluate(() => {
    const win = window as unknown as { setId: (v: number) => void };
    win.setId(4);
  });

  // Should be pending with id=4
  await expect(page.locator('[data-testid="id"]')).toHaveText("4");
  await expect(page.locator('[data-testid="status"]')).toHaveText("pending");

  // Only the latest (id=4) should resolve
  await expect(page.locator('[data-testid="status"]')).toHaveText("resolved:Result 4", {
    timeout: 3000,
  });

  // Verify stale results from id 1, 2, 3 did not appear
  await page.waitForTimeout(500);
  await expect(page.locator('[data-testid="status"]')).toHaveText("resolved:Result 4");
  await expect(page.locator('[data-testid="id"]')).toHaveText("4");
});

test("useResolve: AbortSignal is aborted on deps change", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, useResolve } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.abortCount = 0;

    function* DataLoader(_: object) {
      const [id, setId] = yield* useState(1);
      win.setId = setId;

      const data = yield* useResolve<string>(
        {
          fn: (signal) => {
            signal.addEventListener(
              "abort",
              () => {
                win.abortCount = (win.abortCount as number) + 1;
              },
              { once: true },
            );
            return new Promise<string>((resolve) => setTimeout(() => resolve(`Data ${id}`), 200));
          },
          loading: createElement("p", { "data-testid": "loading" }, "Loading..."),
          error: createElement("p", { "data-testid": "error" }, "Error!"),
        },
        [id],
      );
      return createElement(
        "div",
        null,
        createElement("p", { "data-testid": "data" }, data),
        createElement("p", { "data-testid": "id" }, String(id)),
      );
    }

    render(createElement(DataLoader as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initial loading
  await expect(page.locator('[data-testid="loading"]')).toHaveText("Loading...");

  // Wait for first resolve
  await expect(page.locator('[data-testid="data"]')).toHaveText("Data 1", { timeout: 3000 });

  // No aborts yet
  const abortCountBefore = await page.evaluate(
    () => (window as unknown as Record<string, unknown>).abortCount,
  );
  expect(abortCountBefore).toBe(0);

  // Change deps — should abort previous signal and restart
  await page.evaluate(() => {
    (window as unknown as { setId: (v: number) => void }).setId(2);
  });

  // Previous signal should have been aborted
  const abortCountAfter = await page.evaluate(
    () => (window as unknown as Record<string, unknown>).abortCount,
  );
  expect(abortCountAfter).toBe(1);

  // Should show loading again while new fetch is in progress
  await expect(page.locator('[data-testid="loading"]')).toHaveText("Loading...");

  // New data should resolve
  await expect(page.locator('[data-testid="data"]')).toHaveText("Data 2", { timeout: 3000 });
  await expect(page.locator('[data-testid="id"]')).toHaveText("2");
});
