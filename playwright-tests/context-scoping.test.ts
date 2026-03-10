/**
 * Visual tests for context scoping patterns: independent contexts, nested
 * overrides, default values, sibling isolation, cross-context independence,
 * state preservation, provider removal, deep nesting, multi-consumer updates,
 * and selective consumer triggering.
 */
import { expect, test } from "./fixtures";

test("two independent contexts (Theme + Locale) used simultaneously", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");
    const LocaleCtx = createContext<string>("en");

    function* Consumer() {
      const theme = yield* useContext(ThemeCtx);
      const locale = yield* useContext(LocaleCtx);
      return createElement(
        "div",
        { id: "consumer" },
        createElement("span", { id: "theme" }, theme),
        createElement("span", { id: "locale" }, locale),
      );
    }

    render(
      createElement(
        ThemeCtx.Provider as never,
        { value: "dark" },
        createElement(
          LocaleCtx.Provider as never,
          { value: "fi" },
          createElement(Consumer as never, {}),
        ),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.locator("#theme")).toHaveText("dark");
  await expect(page.locator("#locale")).toHaveText("fi");
  await page.screenshot({ path: "/tmp/visual-ctx-scoping-two-independent.png" });
});

test("nested provider overrides outer provider value", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    function* Consumer() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { className: "theme-val" }, theme);
    }

    // Outer provides "dark", inner overrides to "blue"
    render(
      createElement(
        ThemeCtx.Provider as never,
        { value: "dark" },
        createElement(
          "div",
          { id: "outer-scope" },
          createElement(Consumer as never, {}),
          createElement(
            ThemeCtx.Provider as never,
            { value: "blue" },
            createElement("div", { id: "inner-scope" }, createElement(Consumer as never, {})),
          ),
        ),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  const values = page.locator(".theme-val");
  await expect(values).toHaveCount(2);
  // First consumer (outer) gets "dark"
  await expect(values.nth(0)).toHaveText("dark");
  // Second consumer (inner, overridden) gets "blue"
  await expect(values.nth(1)).toHaveText("blue");
  await page.screenshot({ path: "/tmp/visual-ctx-scoping-nested-override.png" });
});

test("consumer outside provider gets default value", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("default-theme");

    function* Consumer() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { className: "theme-val" }, theme);
    }

    function* App() {
      return createElement(
        "div",
        null,
        // Consumer outside any Provider
        createElement("div", { id: "outside" }, createElement(Consumer as never, {})),
        // Consumer inside Provider
        createElement(
          ThemeCtx.Provider as never,
          { value: "provided" },
          createElement("div", { id: "inside" }, createElement(Consumer as never, {})),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#outside .theme-val")).toHaveText("default-theme");
  await expect(page.locator("#inside .theme-val")).toHaveText("provided");
  await page.screenshot({ path: "/tmp/visual-ctx-scoping-default-value.png" });
});

test("sibling providers provide isolated values", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    function* Consumer({ id }: { id: string }) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { id }, theme);
    }

    function* App() {
      return createElement(
        "div",
        null,
        createElement(
          ThemeCtx.Provider as never,
          { value: "red" },
          createElement(Consumer as never, { id: "sibling-a" }),
        ),
        createElement(
          ThemeCtx.Provider as never,
          { value: "green" },
          createElement(Consumer as never, { id: "sibling-b" }),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#sibling-a")).toHaveText("red");
  await expect(page.locator("#sibling-b")).toHaveText("green");
  await page.screenshot({ path: "/tmp/visual-ctx-scoping-sibling-isolation.png" });
});

test("toggling one context does not affect other context consumers", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useState, useRef, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");
    const LocaleCtx = createContext<string>("en");

    function* ThemeConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const theme = yield* useContext(ThemeCtx);
      return createElement(
        "div",
        null,
        createElement("span", { id: "t-val" }, theme),
        createElement("span", { id: "t-renders" }, String(renders.current)),
      );
    }

    function* LocaleConsumer() {
      const renders = yield* useRef(0);
      renders.current++;
      const locale = yield* useContext(LocaleCtx);
      return createElement(
        "div",
        null,
        createElement("span", { id: "l-val" }, locale),
        createElement("span", { id: "l-renders" }, String(renders.current)),
      );
    }

    function* App() {
      const [theme, setTheme] = yield* useState("light");
      const [locale] = yield* useState("en");
      (window as unknown as Record<string, unknown>).__setTheme = setTheme;
      return createElement(
        ThemeCtx.Provider as never,
        { value: theme },
        createElement(
          LocaleCtx.Provider as never,
          { value: locale },
          createElement(ThemeConsumer as never, {}),
          createElement(LocaleConsumer as never, {}),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#t-val")).toHaveText("light");
  await expect(page.locator("#l-val")).toHaveText("en");
  await expect(page.locator("#t-renders")).toHaveText("1");
  await expect(page.locator("#l-renders")).toHaveText("1");

  // Toggle theme — locale consumer render count must stay at 1
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: string) => void>).__setTheme;
    set("dark");
  });

  await expect(page.locator("#t-val")).toHaveText("dark");
  await expect(page.locator("#t-renders")).toHaveText("2");
  // Locale consumer was not subscribed to theme — render count stays at 1
  await expect(page.locator("#l-val")).toHaveText("en");
  await expect(page.locator("#l-renders")).toHaveText("1");
  await page.screenshot({ path: "/tmp/visual-ctx-scoping-toggle-independence.png" });
});

test("state preserved in consumer across context value changes", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    function* Consumer() {
      const theme = yield* useContext(ThemeCtx);
      const [localCount, setLocalCount] = yield* useState(0);
      (window as unknown as Record<string, unknown>).__setLocal = setLocalCount;
      return createElement(
        "div",
        null,
        createElement("span", { id: "ctx-val" }, theme),
        createElement("span", { id: "local-val" }, String(localCount)),
      );
    }

    function* App() {
      const [theme, setTheme] = yield* useState("light");
      (window as unknown as Record<string, unknown>).__setTheme = setTheme;
      return createElement(
        ThemeCtx.Provider as never,
        { value: theme },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Set local state to 42
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: number) => void>).__setLocal;
    set(42);
  });
  await expect(page.locator("#local-val")).toHaveText("42");

  // Change context value — local state must survive
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: string) => void>).__setTheme;
    set("dark");
  });
  await expect(page.locator("#ctx-val")).toHaveText("dark");
  await expect(page.locator("#local-val")).toHaveText("42");

  // Change context value again — local state still survives
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: string) => void>).__setTheme;
    set("contrast");
  });
  await expect(page.locator("#ctx-val")).toHaveText("contrast");
  await expect(page.locator("#local-val")).toHaveText("42");
  await page.screenshot({ path: "/tmp/visual-ctx-scoping-state-preserved.png" });
});

test("provider removal: consumer falls back to default", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("fallback");

    function* Consumer() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { id: "theme-val" }, theme);
    }

    function* App() {
      const [withProvider, setWithProvider] = yield* useState(true);
      (window as unknown as Record<string, unknown>).__setWithProvider = setWithProvider;

      if (withProvider) {
        return createElement(
          ThemeCtx.Provider as never,
          { value: "provided" },
          createElement(Consumer as never, {}),
        );
      }
      return createElement(Consumer as never, {});
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#theme-val")).toHaveText("provided");

  // Remove the provider — consumer should get the default value
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: boolean) => void>).__setWithProvider;
    set(false);
  });

  await expect(page.locator("#theme-val")).toHaveText("fallback");
  await page.screenshot({ path: "/tmp/visual-ctx-scoping-provider-removal.png" });
});

test("deep nesting: grandchild consumer reads correct provider value", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    function* GrandChild() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { id: "grandchild" }, theme);
    }

    function* Child() {
      return createElement("div", { id: "child" }, createElement(GrandChild as never, {}));
    }

    function* Parent() {
      return createElement("div", { id: "parent" }, createElement(Child as never, {}));
    }

    render(
      createElement(
        ThemeCtx.Provider as never,
        { value: "deep-dark" },
        createElement(Parent as never, {}),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.locator("#grandchild")).toHaveText("deep-dark");
  await page.screenshot({ path: "/tmp/visual-ctx-scoping-deep-nesting.png" });
});

test("multiple consumers of same context all update together", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    function* ConsumerA() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { id: "consumer-a" }, theme);
    }

    function* ConsumerB() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { id: "consumer-b" }, theme);
    }

    function* ConsumerC() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { id: "consumer-c" }, theme);
    }

    function* App() {
      const [theme, setTheme] = yield* useState("light");
      (window as unknown as Record<string, unknown>).__setTheme = setTheme;
      return createElement(
        ThemeCtx.Provider as never,
        { value: theme },
        createElement(ConsumerA as never, {}),
        createElement(ConsumerB as never, {}),
        createElement(ConsumerC as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#consumer-a")).toHaveText("light");
  await expect(page.locator("#consumer-b")).toHaveText("light");
  await expect(page.locator("#consumer-c")).toHaveText("light");

  // Change context — all three consumers must update
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: string) => void>).__setTheme;
    set("dark");
  });

  await expect(page.locator("#consumer-a")).toHaveText("dark");
  await expect(page.locator("#consumer-b")).toHaveText("dark");
  await expect(page.locator("#consumer-c")).toHaveText("dark");

  // Change again
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: string) => void>).__setTheme;
    set("neon");
  });

  await expect(page.locator("#consumer-a")).toHaveText("neon");
  await expect(page.locator("#consumer-b")).toHaveText("neon");
  await expect(page.locator("#consumer-c")).toHaveText("neon");
  await page.screenshot({ path: "/tmp/visual-ctx-scoping-multi-consumer.png" });
});

test("context value change triggers only subscribed consumers", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useState, useRef, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");
    const LocaleCtx = createContext<string>("en");

    // Subscribes to ThemeCtx only
    function* ThemeOnly() {
      const renders = yield* useRef(0);
      renders.current++;
      const theme = yield* useContext(ThemeCtx);
      return createElement(
        "div",
        null,
        createElement("span", { id: "theme-only-val" }, theme),
        createElement("span", { id: "theme-only-renders" }, String(renders.current)),
      );
    }

    // Subscribes to LocaleCtx only
    function* LocaleOnly() {
      const renders = yield* useRef(0);
      renders.current++;
      const locale = yield* useContext(LocaleCtx);
      return createElement(
        "div",
        null,
        createElement("span", { id: "locale-only-val" }, locale),
        createElement("span", { id: "locale-only-renders" }, String(renders.current)),
      );
    }

    // Subscribes to both
    function* Both() {
      const renders = yield* useRef(0);
      renders.current++;
      const theme = yield* useContext(ThemeCtx);
      const locale = yield* useContext(LocaleCtx);
      return createElement(
        "div",
        null,
        createElement("span", { id: "both-theme" }, theme),
        createElement("span", { id: "both-locale" }, locale),
        createElement("span", { id: "both-renders" }, String(renders.current)),
      );
    }

    function* App() {
      const [theme, setTheme] = yield* useState("light");
      const [locale, setLocale] = yield* useState("en");
      (window as unknown as Record<string, unknown>).__setTheme = setTheme;
      (window as unknown as Record<string, unknown>).__setLocale = setLocale;
      return createElement(
        ThemeCtx.Provider as never,
        { value: theme },
        createElement(
          LocaleCtx.Provider as never,
          { value: locale },
          createElement(ThemeOnly as never, {}),
          createElement(LocaleOnly as never, {}),
          createElement(Both as never, {}),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initial: all rendered once
  await expect(page.locator("#theme-only-renders")).toHaveText("1");
  await expect(page.locator("#locale-only-renders")).toHaveText("1");
  await expect(page.locator("#both-renders")).toHaveText("1");

  // Change theme only — ThemeOnly and Both re-render, LocaleOnly does not
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: string) => void>).__setTheme;
    set("dark");
  });

  await expect(page.locator("#theme-only-val")).toHaveText("dark");
  await expect(page.locator("#theme-only-renders")).toHaveText("2");
  await expect(page.locator("#locale-only-val")).toHaveText("en");
  await expect(page.locator("#locale-only-renders")).toHaveText("1");
  await expect(page.locator("#both-theme")).toHaveText("dark");
  await expect(page.locator("#both-renders")).toHaveText("2");

  // Change locale only — LocaleOnly and Both re-render, ThemeOnly does not
  await page.evaluate(() => {
    const set = (window as unknown as Record<string, (v: string) => void>).__setLocale;
    set("fi");
  });

  await expect(page.locator("#theme-only-val")).toHaveText("dark");
  await expect(page.locator("#theme-only-renders")).toHaveText("2");
  await expect(page.locator("#locale-only-val")).toHaveText("fi");
  await expect(page.locator("#locale-only-renders")).toHaveText("2");
  await expect(page.locator("#both-locale")).toHaveText("fi");
  await expect(page.locator("#both-renders")).toHaveText("3");
  await page.screenshot({ path: "/tmp/visual-ctx-scoping-selective-trigger.png" });
});
