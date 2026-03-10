/**
 * Visual tests for lazy context: useContext with selector and transform
 * overloads. Validates rerender suppression, render counts, transform
 * output, hook state preservation, and multi-selector scenarios.
 */
import { expect, test } from "./fixtures";

test("no-selector consumer rerenders on ANY context field change", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { user: { name: string; role: string }; count: number };
    const Ctx = createContext<State>({ user: { name: "Alice", role: "admin" }, count: 0 });

    let setSt: ((v: State) => void) | null = null;

    function* NoSelectorConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const ctx = yield* useContext(Ctx);
      return createElement("div", { id: "consumer" }, [
        createElement("span", { id: "name" }, ctx.user.name),
        createElement("span", { id: "count" }, String(ctx.count)),
        createElement("span", { id: "renders" }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* useState<State>({
        user: { name: "Alice", role: "admin" },
        count: 0,
      });
      setSt = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(NoSelectorConsumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt?.(v);
  });

  await expect(page.locator("#name")).toHaveText("Alice");
  await expect(page.locator("#count")).toHaveText("0");
  await expect(page.locator("#renders")).toHaveText("1");

  // Change only count — no selector, so consumer rerenders
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Alice", role: "admin" }, count: 5 });
  });
  await expect(page.locator("#count")).toHaveText("5");
  await expect(page.locator("#renders")).toHaveText("2");

  // Change only name — still rerenders
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Bob", role: "admin" }, count: 5 });
  });
  await expect(page.locator("#name")).toHaveText("Bob");
  await expect(page.locator("#renders")).toHaveText("3");

  // Change only role — still rerenders
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Bob", role: "editor" }, count: 5 });
  });
  await expect(page.locator("#renders")).toHaveText("4");
});

test("selector consumer only rerenders when selected field changes", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { user: { name: string; role: string }; count: number };
    const Ctx = createContext<State>({ user: { name: "Alice", role: "admin" }, count: 0 });

    let setSt: ((v: State) => void) | null = null;

    function* SelectorConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const ctx = yield* useContext(Ctx, (c) => [c.user.name]);
      return createElement("div", { id: "consumer" }, [
        createElement("span", { id: "name" }, ctx.user.name),
        createElement("span", { id: "renders" }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* useState<State>({
        user: { name: "Alice", role: "admin" },
        count: 0,
      });
      setSt = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(SelectorConsumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt?.(v);
  });

  await expect(page.locator("#name")).toHaveText("Alice");
  await expect(page.locator("#renders")).toHaveText("1");

  // Change only count — selector tracks name, consumer must NOT rerender
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Alice", role: "admin" }, count: 99 });
  });
  await expect(page.locator("#renders")).toHaveText("1");

  // Change name — selector dep changed, consumer MUST rerender
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Bob", role: "admin" }, count: 99 });
  });
  await expect(page.locator("#name")).toHaveText("Bob");
  await expect(page.locator("#renders")).toHaveText("2");
});

test("transform consumer returns transformed value", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { user: { name: string; role: string }; count: number };
    const Ctx = createContext<State>({ user: { name: "Alice", role: "admin" }, count: 0 });

    function* TransformConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const upper = yield* useContext(
        Ctx,
        (c) => [c.user.name] as [string],
        (name) => name.toUpperCase(),
      );
      return createElement("div", { id: "consumer" }, [
        createElement("span", { id: "upper" }, upper),
        createElement("span", { id: "renders" }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st] = yield* useState<State>({ user: { name: "Alice", role: "admin" }, count: 0 });
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(TransformConsumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#upper")).toHaveText("ALICE");
  await expect(page.locator("#renders")).toHaveText("1");
});

test("render count: selector consumer has fewer renders than no-selector", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { user: { name: string; role: string }; count: number };
    const Ctx = createContext<State>({ user: { name: "Alice", role: "admin" }, count: 0 });

    let setSt: ((v: State) => void) | null = null;

    function* NoSelectorConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const ctx = yield* useContext(Ctx);
      return createElement("div", null, [
        createElement("span", { id: "no-sel-count" }, String(ctx.count)),
        createElement("span", { id: "no-sel-renders" }, String(renders.current)),
      ]);
    }

    function* SelectorConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      yield* useContext(Ctx, (c) => [c.user.name]);
      return createElement("span", { id: "sel-renders" }, String(renders.current));
    }

    function* App() {
      const [st, set] = yield* useState<State>({
        user: { name: "Alice", role: "admin" },
        count: 0,
      });
      setSt = set;
      return createElement(Ctx.Provider as never, { value: st }, [
        createElement(NoSelectorConsumer as never, {}),
        createElement(SelectorConsumer as never, {}),
      ]);
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt?.(v);
  });

  await expect(page.locator("#no-sel-renders")).toHaveText("1");
  await expect(page.locator("#sel-renders")).toHaveText("1");

  // Change count three times — no-selector rerenders each time, selector does not
  for (let i = 1; i <= 3; i++) {
    await page.evaluate((i) => {
      type State = { user: { name: string; role: string }; count: number };
      const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
      set({ user: { name: "Alice", role: "admin" }, count: i });
    }, i);
  }

  await expect(page.locator("#no-sel-count")).toHaveText("3");
  await expect(page.locator("#no-sel-renders")).toHaveText("4"); // 1 initial + 3 updates
  await expect(page.locator("#sel-renders")).toHaveText("1"); // never changed
});

test("changing untracked field: selector consumer does NOT rerender", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { user: { name: string; role: string }; count: number };
    const Ctx = createContext<State>({ user: { name: "Alice", role: "admin" }, count: 0 });

    let setSt: ((v: State) => void) | null = null;

    // Selector tracks only user.name — role and count are untracked
    function* Consumer() {
      const renders = yield* useRef(0);
      renders.current++;
      yield* useContext(Ctx, (c) => [c.user.name]);
      return createElement("span", { id: "renders" }, String(renders.current));
    }

    function* App() {
      const [st, set] = yield* useState<State>({
        user: { name: "Alice", role: "admin" },
        count: 0,
      });
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

  await expect(page.locator("#renders")).toHaveText("1");

  // Change role (untracked)
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Alice", role: "editor" }, count: 0 });
  });
  await expect(page.locator("#renders")).toHaveText("1");

  // Change count (untracked)
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Alice", role: "editor" }, count: 42 });
  });
  await expect(page.locator("#renders")).toHaveText("1");

  // Change both untracked fields at once
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Alice", role: "viewer" }, count: 100 });
  });
  await expect(page.locator("#renders")).toHaveText("1");
});

test("changing tracked field: selector consumer DOES rerender", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { user: { name: string; role: string }; count: number };
    const Ctx = createContext<State>({ user: { name: "Alice", role: "admin" }, count: 0 });

    let setSt: ((v: State) => void) | null = null;

    function* Consumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const ctx = yield* useContext(Ctx, (c) => [c.user.name]);
      return createElement("div", { id: "consumer" }, [
        createElement("span", { id: "name" }, ctx.user.name),
        createElement("span", { id: "renders" }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* useState<State>({
        user: { name: "Alice", role: "admin" },
        count: 0,
      });
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

  // Change tracked field (name)
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Bob", role: "admin" }, count: 0 });
  });
  await expect(page.locator("#name")).toHaveText("Bob");
  await expect(page.locator("#renders")).toHaveText("2");

  // Change tracked field again
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Charlie", role: "admin" }, count: 0 });
  });
  await expect(page.locator("#name")).toHaveText("Charlie");
  await expect(page.locator("#renders")).toHaveText("3");
});

test("transform output updates when tracked field changes", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { user: { name: string; role: string }; count: number };
    const Ctx = createContext<State>({ user: { name: "Alice", role: "admin" }, count: 0 });

    let setSt: ((v: State) => void) | null = null;

    function* TransformConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const upper = yield* useContext(
        Ctx,
        (c) => [c.user.name] as [string],
        (name) => name.toUpperCase(),
      );
      return createElement("div", { id: "consumer" }, [
        createElement("span", { id: "upper" }, upper),
        createElement("span", { id: "renders" }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* useState<State>({
        user: { name: "Alice", role: "admin" },
        count: 0,
      });
      setSt = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(TransformConsumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt?.(v);
  });

  await expect(page.locator("#upper")).toHaveText("ALICE");
  await expect(page.locator("#renders")).toHaveText("1");

  // Change untracked field — transform output stays the same, no rerender
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Alice", role: "editor" }, count: 10 });
  });
  await expect(page.locator("#upper")).toHaveText("ALICE");
  await expect(page.locator("#renders")).toHaveText("1");

  // Change tracked field — transform output updates
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Bob", role: "editor" }, count: 10 });
  });
  await expect(page.locator("#upper")).toHaveText("BOB");
  await expect(page.locator("#renders")).toHaveText("2");

  // Change tracked field again
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Charlie", role: "editor" }, count: 10 });
  });
  await expect(page.locator("#upper")).toHaveText("CHARLIE");
  await expect(page.locator("#renders")).toHaveText("3");
});

test("hook state (useRef) preserved when selector suppresses rerender", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { user: { name: string; role: string }; count: number };
    const Ctx = createContext<State>({ user: { name: "Alice", role: "admin" }, count: 0 });

    let setSt: ((v: State) => void) | null = null;
    let setLocal: ((v: number) => void) | null = null;

    function* Consumer() {
      const renders = yield* useRef(0);
      renders.current++;
      yield* useContext(Ctx, (c) => [c.user.name]);
      const [local, sl] = yield* useState(42);
      setLocal = sl;
      return createElement("div", { id: "consumer" }, [
        createElement("span", { id: "local" }, String(local)),
        createElement("span", { id: "renders" }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* useState<State>({
        user: { name: "Alice", role: "admin" },
        count: 0,
      });
      setSt = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt?.(v);
    (window as unknown as Record<string, unknown>).__setLocal = (v: number) => setLocal?.(v);
  });

  await expect(page.locator("#local")).toHaveText("42");
  await expect(page.locator("#renders")).toHaveText("1");

  // Set local state to 100
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: number) => void>).__setLocal;
    set(100);
  });
  await expect(page.locator("#local")).toHaveText("100");
  await expect(page.locator("#renders")).toHaveText("2");

  // Change untracked fields — selector suppresses rerender, local state must survive
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Alice", role: "editor" }, count: 99 });
  });
  await expect(page.locator("#local")).toHaveText("100");
  await expect(page.locator("#renders")).toHaveText("2"); // no rerender

  // Now change tracked field — rerenders, but local state is preserved (in-place rerender)
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Bob", role: "editor" }, count: 99 });
  });
  await expect(page.locator("#local")).toHaveText("100"); // local state preserved
  await expect(page.locator("#renders")).toHaveText("3");
});

test("multiple selectors tracking different fields", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { user: { name: string; role: string }; count: number };
    const Ctx = createContext<State>({ user: { name: "Alice", role: "admin" }, count: 0 });

    let setSt: ((v: State) => void) | null = null;

    // Tracks user.name only
    function* NameConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const ctx = yield* useContext(Ctx, (c) => [c.user.name]);
      return createElement("div", null, [
        createElement("span", { id: "name-val" }, ctx.user.name),
        createElement("span", { id: "name-renders" }, String(renders.current)),
      ]);
    }

    // Tracks count only
    function* CountConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const ctx = yield* useContext(Ctx, (c) => [c.count]);
      return createElement("div", null, [
        createElement("span", { id: "count-val" }, String(ctx.count)),
        createElement("span", { id: "count-renders" }, String(renders.current)),
      ]);
    }

    // Tracks user.role only
    function* RoleConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const ctx = yield* useContext(Ctx, (c) => [c.user.role]);
      return createElement("div", null, [
        createElement("span", { id: "role-val" }, ctx.user.role),
        createElement("span", { id: "role-renders" }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* useState<State>({
        user: { name: "Alice", role: "admin" },
        count: 0,
      });
      setSt = set;
      return createElement(Ctx.Provider as never, { value: st }, [
        createElement(NameConsumer as never, {}),
        createElement(CountConsumer as never, {}),
        createElement(RoleConsumer as never, {}),
      ]);
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt?.(v);
  });

  // Initial state
  await expect(page.locator("#name-val")).toHaveText("Alice");
  await expect(page.locator("#count-val")).toHaveText("0");
  await expect(page.locator("#role-val")).toHaveText("admin");
  await expect(page.locator("#name-renders")).toHaveText("1");
  await expect(page.locator("#count-renders")).toHaveText("1");
  await expect(page.locator("#role-renders")).toHaveText("1");

  // Change only name — only NameConsumer rerenders
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Bob", role: "admin" }, count: 0 });
  });
  await expect(page.locator("#name-val")).toHaveText("Bob");
  await expect(page.locator("#name-renders")).toHaveText("2");
  await expect(page.locator("#count-renders")).toHaveText("1"); // unchanged
  await expect(page.locator("#role-renders")).toHaveText("1"); // unchanged

  // Change only count — only CountConsumer rerenders
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Bob", role: "admin" }, count: 7 });
  });
  await expect(page.locator("#count-val")).toHaveText("7");
  await expect(page.locator("#name-renders")).toHaveText("2"); // unchanged
  await expect(page.locator("#count-renders")).toHaveText("2");
  await expect(page.locator("#role-renders")).toHaveText("1"); // unchanged

  // Change only role — only RoleConsumer rerenders
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Bob", role: "editor" }, count: 7 });
  });
  await expect(page.locator("#role-val")).toHaveText("editor");
  await expect(page.locator("#name-renders")).toHaveText("2"); // unchanged
  await expect(page.locator("#count-renders")).toHaveText("2"); // unchanged
  await expect(page.locator("#role-renders")).toHaveText("2");
});

test("selector with multiple tracked deps: rerenders when any tracked dep changes", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext, useRef } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type State = { user: { name: string; role: string }; count: number };
    const Ctx = createContext<State>({ user: { name: "Alice", role: "admin" }, count: 0 });

    let setSt: ((v: State) => void) | null = null;

    // Selector tracks both user.name AND user.role
    function* MultiDepConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const ctx = yield* useContext(Ctx, (c) => [c.user.name, c.user.role]);
      return createElement("div", { id: "consumer" }, [
        createElement("span", { id: "name" }, ctx.user.name),
        createElement("span", { id: "role" }, ctx.user.role),
        createElement("span", { id: "renders" }, String(renders.current)),
      ]);
    }

    function* App() {
      const [st, set] = yield* useState<State>({
        user: { name: "Alice", role: "admin" },
        count: 0,
      });
      setSt = set;
      return createElement(
        Ctx.Provider as never,
        { value: st },
        createElement(MultiDepConsumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__setSt = (v: State) => setSt?.(v);
  });

  await expect(page.locator("#name")).toHaveText("Alice");
  await expect(page.locator("#role")).toHaveText("admin");
  await expect(page.locator("#renders")).toHaveText("1");

  // Change count (untracked) — no rerender
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Alice", role: "admin" }, count: 50 });
  });
  await expect(page.locator("#renders")).toHaveText("1");

  // Change name (tracked dep 1) — rerenders
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Bob", role: "admin" }, count: 50 });
  });
  await expect(page.locator("#name")).toHaveText("Bob");
  await expect(page.locator("#renders")).toHaveText("2");

  // Change role (tracked dep 2) — rerenders
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Bob", role: "editor" }, count: 50 });
  });
  await expect(page.locator("#role")).toHaveText("editor");
  await expect(page.locator("#renders")).toHaveText("3");

  // Change both tracked deps simultaneously — rerenders once
  await page.evaluate(() => {
    type State = { user: { name: string; role: string }; count: number };
    const set = (window as unknown as Record<string, (v: State) => void>).__setSt;
    set({ user: { name: "Charlie", role: "viewer" }, count: 50 });
  });
  await expect(page.locator("#name")).toHaveText("Charlie");
  await expect(page.locator("#role")).toHaveText("viewer");
  await expect(page.locator("#renders")).toHaveText("4");
});
