/**
 * E2E tests for context scoping: independent contexts, nested providers,
 * sibling isolation, default values, and multi-context consumption.
 */
import { expect, test } from "./fixtures";

test("two independent contexts toggled independently", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");
    const LocaleCtx = createContext("en");

    function* ThemeDisplay(_: object) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": "theme" }, theme);
    }

    function* LocaleDisplay(_: object) {
      const locale = yield* useContext(LocaleCtx);
      return createElement("span", { "data-testid": "locale" }, locale);
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
            createElement(ThemeDisplay as never, {}),
            createElement(LocaleDisplay as never, {}),
          ),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.getByTestId("theme")).toHaveText("light");
  await expect(page.getByTestId("locale")).toHaveText("en");

  // Toggle theme only — locale unchanged
  await page.getByTestId("toggle-theme").click();
  await expect(page.getByTestId("theme")).toHaveText("dark");
  await expect(page.getByTestId("locale")).toHaveText("en");

  // Toggle locale only — theme unchanged
  await page.getByTestId("toggle-locale").click();
  await expect(page.getByTestId("theme")).toHaveText("dark");
  await expect(page.getByTestId("locale")).toHaveText("fi");

  // Toggle both back to original
  await page.getByTestId("toggle-theme").click();
  await page.getByTestId("toggle-locale").click();
  await expect(page.getByTestId("theme")).toHaveText("light");
  await expect(page.getByTestId("locale")).toHaveText("en");
});

test("nested provider shadows outer provider", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("default");

    function* Consumer({ testid }: { testid: string }) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": testid }, theme);
    }

    render(
      createElement(
        ThemeCtx.Provider as never,
        { value: "outer" },
        createElement(Consumer as never, { testid: "outer-consumer" }),
        createElement(
          ThemeCtx.Provider as never,
          { value: "inner" },
          createElement(Consumer as never, { testid: "inner-consumer" }),
        ),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.getByTestId("outer-consumer")).toHaveText("outer");
  await expect(page.getByTestId("inner-consumer")).toHaveText("inner");
});

test("inner provider always shows its value when outer toggles", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("default");

    function* Consumer({ testid }: { testid: string }) {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { "data-testid": testid }, theme);
    }

    function* App(_: object) {
      const [outer, setOuter] = yield* useState("A");
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "toggle-outer",
            onclick: () => setOuter((v: string) => (v === "A" ? "B" : "A")),
          },
          "Toggle Outer",
        ),
        createElement(
          ThemeCtx.Provider as never,
          { value: outer },
          createElement(Consumer as never, { testid: "outer-consumer" }),
          createElement(
            ThemeCtx.Provider as never,
            { value: "fixed-inner" },
            createElement(Consumer as never, { testid: "inner-consumer" }),
          ),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.getByTestId("outer-consumer")).toHaveText("A");
  await expect(page.getByTestId("inner-consumer")).toHaveText("fixed-inner");

  await page.getByTestId("toggle-outer").click();
  await expect(page.getByTestId("outer-consumer")).toHaveText("B");
  await expect(page.getByTestId("inner-consumer")).toHaveText("fixed-inner");

  await page.getByTestId("toggle-outer").click();
  await expect(page.getByTestId("outer-consumer")).toHaveText("A");
  await expect(page.getByTestId("inner-consumer")).toHaveText("fixed-inner");
});

test("state preserved across context updates", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");

    function* CounterWithTheme(_: object) {
      const theme = yield* useContext(ThemeCtx);
      const [count, setCount] = yield* useState(0);
      return createElement(
        "div",
        null,
        createElement("span", { "data-testid": "theme" }, theme),
        createElement("span", { "data-testid": "count" }, String(count)),
        createElement(
          "button",
          {
            "data-testid": "increment",
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
            "data-testid": "toggle-theme",
            onclick: () => setTheme((t: string) => (t === "light" ? "dark" : "light")),
          },
          "Toggle",
        ),
        createElement(
          ThemeCtx.Provider as never,
          { value: theme },
          createElement(CounterWithTheme as never, {}),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Increment counter to 3
  await page.getByTestId("increment").click();
  await page.getByTestId("increment").click();
  await page.getByTestId("increment").click();
  await expect(page.getByTestId("count")).toHaveText("3");
  await expect(page.getByTestId("theme")).toHaveText("light");

  // Toggle theme — counter must preserve its value
  await page.getByTestId("toggle-theme").click();
  await expect(page.getByTestId("theme")).toHaveText("dark");
  await expect(page.getByTestId("count")).toHaveText("3");

  // Toggle back — counter still preserved
  await page.getByTestId("toggle-theme").click();
  await expect(page.getByTestId("theme")).toHaveText("light");
  await expect(page.getByTestId("count")).toHaveText("3");
});

test("sibling providers isolated — consumers see own provider value", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ColorCtx = createContext("none");

    function* ColorConsumer({ testid }: { testid: string }) {
      const color = yield* useContext(ColorCtx);
      return createElement("span", { "data-testid": testid }, color);
    }

    render(
      createElement(
        "div",
        null,
        createElement(
          ColorCtx.Provider as never,
          { value: "red" },
          createElement(ColorConsumer as never, { testid: "consumer-a" }),
        ),
        createElement(
          ColorCtx.Provider as never,
          { value: "blue" },
          createElement(ColorConsumer as never, { testid: "consumer-b" }),
        ),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.getByTestId("consumer-a")).toHaveText("red");
  await expect(page.getByTestId("consumer-b")).toHaveText("blue");
});

test("toggling sibling A does not affect sibling B", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ColorCtx = createContext("none");

    function* ColorConsumer({ testid }: { testid: string }) {
      const color = yield* useContext(ColorCtx);
      return createElement("span", { "data-testid": testid }, color);
    }

    function* App(_: object) {
      const [colorA, setColorA] = yield* useState("red");
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "toggle-a",
            onclick: () => setColorA((c: string) => (c === "red" ? "green" : "red")),
          },
          "Toggle A",
        ),
        createElement(
          ColorCtx.Provider as never,
          { value: colorA },
          createElement(ColorConsumer as never, { testid: "consumer-a" }),
        ),
        createElement(
          ColorCtx.Provider as never,
          { value: "blue" },
          createElement(ColorConsumer as never, { testid: "consumer-b" }),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.getByTestId("consumer-a")).toHaveText("red");
  await expect(page.getByTestId("consumer-b")).toHaveText("blue");

  // Toggle sibling A — sibling B must remain unchanged
  await page.getByTestId("toggle-a").click();
  await expect(page.getByTestId("consumer-a")).toHaveText("green");
  await expect(page.getByTestId("consumer-b")).toHaveText("blue");

  // Toggle again
  await page.getByTestId("toggle-a").click();
  await expect(page.getByTestId("consumer-a")).toHaveText("red");
  await expect(page.getByTestId("consumer-b")).toHaveText("blue");
});

test("consumer reads default when no Provider wraps it", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const LangCtx = createContext("default-lang");

    function* LangConsumer(_: object) {
      const lang = yield* useContext(LangCtx);
      return createElement("span", { "data-testid": "lang" }, lang);
    }

    // No Provider — consumer should read the createContext default value
    render(
      createElement(LangConsumer as never, {}),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.getByTestId("lang")).toHaveText("default-lang");
});

test("deeply nested consumer reads nearest provider (3+ levels)", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const DepthCtx = createContext("root");

    function* DepthConsumer({ testid }: { testid: string }) {
      const value = yield* useContext(DepthCtx);
      return createElement("span", { "data-testid": testid }, value);
    }

    // level-0 provider = "L0"
    //   consumer at L0
    //   level-1 provider = "L1"
    //     consumer at L1
    //     level-2 provider = "L2"
    //       consumer at L2
    render(
      createElement(
        DepthCtx.Provider as never,
        { value: "L0" },
        createElement(DepthConsumer as never, { testid: "at-l0" }),
        createElement(
          DepthCtx.Provider as never,
          { value: "L1" },
          createElement(DepthConsumer as never, { testid: "at-l1" }),
          createElement(
            DepthCtx.Provider as never,
            { value: "L2" },
            createElement(DepthConsumer as never, { testid: "at-l2" }),
          ),
        ),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.getByTestId("at-l0")).toHaveText("L0");
  await expect(page.getByTestId("at-l1")).toHaveText("L1");
  await expect(page.getByTestId("at-l2")).toHaveText("L2");
});

test("one component consumes multiple context values", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");
    const LocaleCtx = createContext("en");

    function* MultiConsumer(_: object) {
      const theme = yield* useContext(ThemeCtx);
      const locale = yield* useContext(LocaleCtx);
      return createElement("span", { "data-testid": "combined" }, `${theme}/${locale}`);
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
          "Theme",
        ),
        createElement(
          "button",
          {
            "data-testid": "toggle-locale",
            onclick: () => setLocale((l: string) => (l === "en" ? "fi" : "en")),
          },
          "Locale",
        ),
        createElement(
          ThemeCtx.Provider as never,
          { value: theme },
          createElement(
            LocaleCtx.Provider as never,
            { value: locale },
            createElement(MultiConsumer as never, {}),
          ),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.getByTestId("combined")).toHaveText("light/en");

  await page.getByTestId("toggle-theme").click();
  await expect(page.getByTestId("combined")).toHaveText("dark/en");

  await page.getByTestId("toggle-locale").click();
  await expect(page.getByTestId("combined")).toHaveText("dark/fi");

  await page.getByTestId("toggle-theme").click();
  await expect(page.getByTestId("combined")).toHaveText("light/fi");
});

test("provider value update propagates to all descendants at different depths", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState, createContext, useContext } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ColorCtx = createContext("initial");

    function* ShallowConsumer(_: object) {
      const color = yield* useContext(ColorCtx);
      return createElement("span", { "data-testid": "shallow" }, color);
    }

    function* MidWrapper(_: object) {
      const color = yield* useContext(ColorCtx);
      return createElement(
        "div",
        null,
        createElement("span", { "data-testid": "mid" }, color),
        createElement(DeepConsumer as never, {}),
      );
    }

    function* DeepConsumer(_: object) {
      const color = yield* useContext(ColorCtx);
      return createElement("span", { "data-testid": "deep" }, color);
    }

    function* App(_: object) {
      const [color, setColor] = yield* useState("red");
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "set-blue",
            onclick: () => setColor("blue"),
          },
          "Blue",
        ),
        createElement(
          "button",
          {
            "data-testid": "set-green",
            onclick: () => setColor("green"),
          },
          "Green",
        ),
        createElement(
          ColorCtx.Provider as never,
          { value: color },
          createElement(ShallowConsumer as never, {}),
          createElement(MidWrapper as never, {}),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initial — all consumers see "red"
  await expect(page.getByTestId("shallow")).toHaveText("red");
  await expect(page.getByTestId("mid")).toHaveText("red");
  await expect(page.getByTestId("deep")).toHaveText("red");

  // Update to blue — all depths update
  await page.getByTestId("set-blue").click();
  await expect(page.getByTestId("shallow")).toHaveText("blue");
  await expect(page.getByTestId("mid")).toHaveText("blue");
  await expect(page.getByTestId("deep")).toHaveText("blue");

  // Update to green — all depths update again
  await page.getByTestId("set-green").click();
  await expect(page.getByTestId("shallow")).toHaveText("green");
  await expect(page.getByTestId("mid")).toHaveText("green");
  await expect(page.getByTestId("deep")).toHaveText("green");
});
