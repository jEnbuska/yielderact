/**
 * E2E tests for the Theme/Context demo: createContext default values,
 * Provider overrides, nested Providers, state preservation across context
 * changes, rapid toggling, and independent context isolation.
 */
import { expect, test } from "./fixtures";

test("default context value when no Provider wraps consumer", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");

    function* ThemeConsumer(_: object) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": "theme-value" }, theme);
    }

    render(
      createElement(ThemeConsumer as never, {}),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.getByTestId("theme-value")).toHaveText("light");
});

test("Provider supplies value to consumer", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");

    function* ThemeConsumer(_: object) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": "theme-value" }, theme);
    }

    render(
      createElement(
        ThemeCtx.Provider as never,
        { value: "dark" },
        createElement(ThemeConsumer as never, {}),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.getByTestId("theme-value")).toHaveText("dark");
});

test("toggle theme changes consumer display", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");

    function* ThemeConsumer(_: object) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": "theme-value" }, theme);
    }

    function* App(_: object) {
      const [theme, setTheme] = yield* useState("light");
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "toggle-btn",
            onclick: () => setTheme((t: string) => (t === "light" ? "dark" : "light")),
          },
          "Toggle",
        ),
        createElement(
          ThemeCtx.Provider as never,
          { value: theme },
          createElement(ThemeConsumer as never, {}),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.getByTestId("theme-value")).toHaveText("light");

  await page.getByTestId("toggle-btn").click();
  await expect(page.getByTestId("theme-value")).toHaveText("dark");

  await page.getByTestId("toggle-btn").click();
  await expect(page.getByTestId("theme-value")).toHaveText("light");
});

test("nested provider overrides outer provider", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");

    function* ThemeConsumer({ testid }: { testid: string }) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": testid }, theme);
    }

    render(
      createElement(
        ThemeCtx.Provider as never,
        { value: "dark" },
        createElement(ThemeConsumer as never, { testid: "outer-consumer" }),
        createElement(
          ThemeCtx.Provider as never,
          { value: "high-contrast" },
          createElement(ThemeConsumer as never, { testid: "inner-consumer" }),
        ),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.getByTestId("outer-consumer")).toHaveText("dark");
  await expect(page.getByTestId("inner-consumer")).toHaveText("high-contrast");
});

test("inner provider always shows its value regardless of outer changes", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");

    function* ThemeConsumer({ testid }: { testid: string }) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": testid }, theme);
    }

    function* App(_: object) {
      const [outerTheme, setOuterTheme] = yield* useState("light");
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "toggle-outer",
            onclick: () => setOuterTheme((t: string) => (t === "light" ? "dark" : "light")),
          },
          "Toggle Outer",
        ),
        createElement(
          ThemeCtx.Provider as never,
          { value: outerTheme },
          createElement(ThemeConsumer as never, { testid: "outer-consumer" }),
          createElement(
            ThemeCtx.Provider as never,
            { value: "always-blue" },
            createElement(ThemeConsumer as never, { testid: "inner-consumer" }),
          ),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.getByTestId("outer-consumer")).toHaveText("light");
  await expect(page.getByTestId("inner-consumer")).toHaveText("always-blue");

  await page.getByTestId("toggle-outer").click();
  await expect(page.getByTestId("outer-consumer")).toHaveText("dark");
  await expect(page.getByTestId("inner-consumer")).toHaveText("always-blue");

  await page.getByTestId("toggle-outer").click();
  await expect(page.getByTestId("outer-consumer")).toHaveText("light");
  await expect(page.getByTestId("inner-consumer")).toHaveText("always-blue");
});

test("state preserved when context value changes (counter keeps value when theme toggles)", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");

    function* ThemedCounter(_: object) {
      const theme = yield* useContext(ThemeCtx);
      const [count, setCount] = yield* useState(0);
      return createElement(
        "div",
        null,
        createElement("span", { "data-testid": "theme-value" }, theme),
        createElement("span", { "data-testid": "counter-value" }, String(count)),
        createElement(
          "button",
          {
            "data-testid": "increment-btn",
            onclick: () => setCount((c: number) => c + 1),
          },
          "+",
        ),
      );
    }

    function* App(_: object) {
      const [theme, setTheme] = yield* useState("light");
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "toggle-btn",
            onclick: () => setTheme((t: string) => (t === "light" ? "dark" : "light")),
          },
          "Toggle",
        ),
        createElement(
          ThemeCtx.Provider as never,
          { value: theme },
          createElement(ThemedCounter as never, {}),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Increment counter a few times
  await page.getByTestId("increment-btn").click();
  await page.getByTestId("increment-btn").click();
  await page.getByTestId("increment-btn").click();
  await expect(page.getByTestId("counter-value")).toHaveText("3");
  await expect(page.getByTestId("theme-value")).toHaveText("light");

  // Toggle theme — counter should preserve its value
  await page.getByTestId("toggle-btn").click();
  await expect(page.getByTestId("theme-value")).toHaveText("dark");
  await expect(page.getByTestId("counter-value")).toHaveText("3");

  // Toggle again — counter still preserved
  await page.getByTestId("toggle-btn").click();
  await expect(page.getByTestId("theme-value")).toHaveText("light");
  await expect(page.getByTestId("counter-value")).toHaveText("3");
});

test("rapid theme toggling works correctly", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");

    function* ThemeConsumer(_: object) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": "theme-value" }, theme);
    }

    function* App(_: object) {
      const [theme, setTheme] = yield* useState("light");
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "toggle-btn",
            onclick: () => setTheme((t: string) => (t === "light" ? "dark" : "light")),
          },
          "Toggle",
        ),
        createElement(
          ThemeCtx.Provider as never,
          { value: theme },
          createElement(ThemeConsumer as never, {}),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Rapidly toggle 10 times (even count = light, odd count = dark)
  for (let i = 0; i < 10; i++) {
    await page.getByTestId("toggle-btn").click();
  }
  // 10 toggles from light -> ends at light
  await expect(page.getByTestId("theme-value")).toHaveText("light");

  // Toggle once more to end on dark
  await page.getByTestId("toggle-btn").click();
  await expect(page.getByTestId("theme-value")).toHaveText("dark");
});

test("two independent contexts do not interfere", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");
    const LocaleCtx = createContext("en");

    function* ThemeConsumer(_: object) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": "theme-value" }, theme);
    }

    function* LocaleConsumer(_: object) {
      const locale = yield* useContext(LocaleCtx);
      return createElement("span", { "data-testid": "locale-value" }, locale);
    }

    function* BothConsumer(_: object) {
      const theme = yield* useContext(ThemeCtx);
      const locale = yield* useContext(LocaleCtx);
      return createElement("span", { "data-testid": "both-value" }, `${theme}/${locale}`);
    }

    function* App(_: object) {
      const [theme, setTheme] = yield* useState("light");
      const [locale, setLocale] = yield* useState("en");
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "toggle-theme",
            onclick: () => setTheme((t: string) => (t === "light" ? "dark" : "light")),
          },
          "Toggle Theme",
        ),
        createElement(
          "button",
          {
            "data-testid": "toggle-locale",
            onclick: () => setLocale((l: string) => (l === "en" ? "fi" : "en")),
          },
          "Toggle Locale",
        ),
        createElement(
          ThemeCtx.Provider as never,
          { value: theme },
          createElement(
            LocaleCtx.Provider as never,
            { value: locale },
            createElement(ThemeConsumer as never, {}),
            createElement(LocaleConsumer as never, {}),
            createElement(BothConsumer as never, {}),
          ),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initial state
  await expect(page.getByTestId("theme-value")).toHaveText("light");
  await expect(page.getByTestId("locale-value")).toHaveText("en");
  await expect(page.getByTestId("both-value")).toHaveText("light/en");

  // Toggle theme only — locale unchanged
  await page.getByTestId("toggle-theme").click();
  await expect(page.getByTestId("theme-value")).toHaveText("dark");
  await expect(page.getByTestId("locale-value")).toHaveText("en");
  await expect(page.getByTestId("both-value")).toHaveText("dark/en");

  // Toggle locale only — theme unchanged
  await page.getByTestId("toggle-locale").click();
  await expect(page.getByTestId("theme-value")).toHaveText("dark");
  await expect(page.getByTestId("locale-value")).toHaveText("fi");
  await expect(page.getByTestId("both-value")).toHaveText("dark/fi");

  // Toggle both back
  await page.getByTestId("toggle-theme").click();
  await page.getByTestId("toggle-locale").click();
  await expect(page.getByTestId("theme-value")).toHaveText("light");
  await expect(page.getByTestId("locale-value")).toHaveText("en");
  await expect(page.getByTestId("both-value")).toHaveText("light/en");
});

test("consumer re-reads context after multiple provider value changes", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");

    function* ThemeConsumer(_: object) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": "theme-value" }, theme);
    }

    function* App(_: object) {
      const [theme, setTheme] = yield* useState("light");
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "set-dark",
            onclick: () => setTheme("dark"),
          },
          "Dark",
        ),
        createElement(
          "button",
          {
            "data-testid": "set-blue",
            onclick: () => setTheme("blue"),
          },
          "Blue",
        ),
        createElement(
          "button",
          {
            "data-testid": "set-light",
            onclick: () => setTheme("light"),
          },
          "Light",
        ),
        createElement(
          ThemeCtx.Provider as never,
          { value: theme },
          createElement(ThemeConsumer as never, {}),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.getByTestId("theme-value")).toHaveText("light");

  await page.getByTestId("set-dark").click();
  await expect(page.getByTestId("theme-value")).toHaveText("dark");

  await page.getByTestId("set-blue").click();
  await expect(page.getByTestId("theme-value")).toHaveText("blue");

  await page.getByTestId("set-light").click();
  await expect(page.getByTestId("theme-value")).toHaveText("light");

  // Cycle through again to confirm stability
  await page.getByTestId("set-blue").click();
  await expect(page.getByTestId("theme-value")).toHaveText("blue");

  await page.getByTestId("set-dark").click();
  await expect(page.getByTestId("theme-value")).toHaveText("dark");
});

test("deeply nested consumer reads from nearest ancestor provider", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("default");

    function* DeepConsumer(_: object) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": "deep-value" }, theme);
    }

    function* Wrapper(_: object) {
      return createElement(
        "div",
        null,
        createElement("div", null, createElement(DeepConsumer as never, {})),
      );
    }

    // outer=A, middle=B, inner has no provider -> consumer reads B (nearest)
    render(
      createElement(
        ThemeCtx.Provider as never,
        { value: "A" },
        createElement(
          ThemeCtx.Provider as never,
          { value: "B" },
          createElement(Wrapper as never, {}),
        ),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.getByTestId("deep-value")).toHaveText("B");
});
