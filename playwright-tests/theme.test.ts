/**
 * Visual tests for Context/Theme pattern: createContext default values,
 * Provider overrides, toggling, nesting, multiple consumers, and rapid changes.
 */
import { expect, test } from "./fixtures";

test("initial theme renders correctly with default value from createContext", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    function* ThemeDisplay() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "theme" }, theme);
    }

    // Wrap in a Provider that passes the same default value
    render(
      createElement(
        ThemeCtx.Provider as never,
        { value: "light" },
        createElement(ThemeDisplay as never, {}),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.locator("#theme")).toHaveText("light");
  await page.screenshot({ path: "/tmp/visual-theme-initial.png" });
});

test("Provider supplies value to child consumer", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    function* ThemeDisplay() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "theme" }, theme);
    }

    render(
      createElement(
        ThemeCtx.Provider as never,
        { value: "dark" },
        createElement(ThemeDisplay as never, {}),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.locator("#theme")).toHaveText("dark");
  await page.screenshot({ path: "/tmp/visual-theme-provider-value.png" });
});

test("toggle theme updates consumer", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    let toggleTheme: (() => void) | null = null;

    function* ThemeDisplay() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "theme" }, theme);
    }

    function* App() {
      const [theme, setTheme] = yield* useState<string>("light");
      toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
      return createElement(
        ThemeCtx.Provider as never,
        { value: theme },
        createElement(ThemeDisplay as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__toggleTheme = () => toggleTheme?.();
  });

  await expect(page.locator("#theme")).toHaveText("light");

  // Toggle to dark
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).__toggleTheme();
  });
  await expect(page.locator("#theme")).toHaveText("dark");
  await page.screenshot({ path: "/tmp/visual-theme-toggle.png" });
});

test("toggle theme back restores original", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    let toggleTheme: (() => void) | null = null;

    function* ThemeDisplay() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "theme" }, theme);
    }

    function* App() {
      const [theme, setTheme] = yield* useState<string>("light");
      toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
      return createElement(
        ThemeCtx.Provider as never,
        { value: theme },
        createElement(ThemeDisplay as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__toggleTheme = () => toggleTheme?.();
  });

  await expect(page.locator("#theme")).toHaveText("light");

  // Toggle to dark
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).__toggleTheme();
  });
  await expect(page.locator("#theme")).toHaveText("dark");

  // Toggle back to light
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).__toggleTheme();
  });
  await expect(page.locator("#theme")).toHaveText("light");
  await page.screenshot({ path: "/tmp/visual-theme-toggle-back.png" });
});

test("nested providers — inner overrides outer", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    function* OuterConsumer() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "outer-theme" }, theme);
    }

    function* InnerConsumer() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "inner-theme" }, theme);
    }

    render(
      createElement(ThemeCtx.Provider as never, { value: "dark" }, [
        createElement(OuterConsumer as never, {}),
        createElement(
          ThemeCtx.Provider as never,
          { value: "high-contrast" },
          createElement(InnerConsumer as never, {}),
        ),
      ]),
      document.getElementById("root") as HTMLElement,
    );
  });

  // Outer consumer sees the outer provider value
  await expect(page.locator("#outer-theme")).toHaveText("dark");
  // Inner consumer sees the inner (overriding) provider value
  await expect(page.locator("#inner-theme")).toHaveText("high-contrast");
  await page.screenshot({ path: "/tmp/visual-theme-nested-providers.png" });
});

test("default value used when no Provider wraps consumer", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("fallback-theme");

    function* ThemeDisplay() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "theme" }, theme);
    }

    // Render without any Provider — should use the createContext default
    render(
      createElement(ThemeDisplay as never, {}),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.locator("#theme")).toHaveText("fallback-theme");
  await page.screenshot({ path: "/tmp/visual-theme-default-no-provider.png" });
});

test("multiple consumers update simultaneously on context change", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    let toggleTheme: (() => void) | null = null;

    function* ConsumerA() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "consumer-a" }, `A:${theme}`);
    }

    function* ConsumerB() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "consumer-b" }, `B:${theme}`);
    }

    function* ConsumerC() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "consumer-c" }, `C:${theme}`);
    }

    function* App() {
      const [theme, setTheme] = yield* useState<string>("light");
      toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
      return createElement(ThemeCtx.Provider as never, { value: theme }, [
        createElement(ConsumerA as never, {}),
        createElement(ConsumerB as never, {}),
        createElement(ConsumerC as never, {}),
      ]);
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__toggleTheme = () => toggleTheme?.();
  });

  // All consumers start with "light"
  await expect(page.locator("#consumer-a")).toHaveText("A:light");
  await expect(page.locator("#consumer-b")).toHaveText("B:light");
  await expect(page.locator("#consumer-c")).toHaveText("C:light");

  // Toggle to dark — all consumers update simultaneously
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).__toggleTheme();
  });

  await expect(page.locator("#consumer-a")).toHaveText("A:dark");
  await expect(page.locator("#consumer-b")).toHaveText("B:dark");
  await expect(page.locator("#consumer-c")).toHaveText("C:dark");
  await page.screenshot({ path: "/tmp/visual-theme-multiple-consumers.png" });
});

test("rapid theme toggling handles fast state changes correctly", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, useContext, useState, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext<string>("light");

    let toggleTheme: (() => void) | null = null;

    function* ThemeDisplay() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("p", { id: "theme" }, theme);
    }

    function* App() {
      const [theme, setTheme] = yield* useState<string>("light");
      toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
      return createElement(
        ThemeCtx.Provider as never,
        { value: theme },
        createElement(ThemeDisplay as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
    (window as unknown as Record<string, unknown>).__toggleTheme = () => toggleTheme?.();
  });

  await expect(page.locator("#theme")).toHaveText("light");

  // Rapid toggles: light -> dark -> light -> dark -> light -> dark (6 toggles, even = light, odd = dark)
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      (window as unknown as Record<string, () => void>).__toggleTheme();
    });
  }

  // 6 toggles from "light" → ends on "light" (even number of toggles)
  await expect(page.locator("#theme")).toHaveText("light");

  // One more toggle → dark
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).__toggleTheme();
  });
  await expect(page.locator("#theme")).toHaveText("dark");

  // Three more rapid toggles → dark -> light -> dark
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      (window as unknown as Record<string, () => void>).__toggleTheme();
    });
  }

  // 3 toggles from "dark" → ends on "light" (odd number of toggles)
  await expect(page.locator("#theme")).toHaveText("light");
  await page.screenshot({ path: "/tmp/visual-theme-rapid-toggle.png" });
});
