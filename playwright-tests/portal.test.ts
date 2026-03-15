/**
 * Visual tests for createPortal: rendering into an external container,
 * context inheritance through portals, and event handling inside portals.
 */
import { expect, test } from "./fixtures";

test("portal renders children into external container", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createPortal, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* App() {
      const [show, setShow] = yield* useState(false);
      win.setShow = setShow;
      return createElement(
        "div",
        { id: "app-root" },
        createElement("span", { id: "app-label" }, "App"),
        show
          ? createPortal(
              createElement("span", { id: "portal-child" }, "I am in the portal"),
              document.getElementById("portal-target") as Element,
            )
          : null,
      );
    }

    // Create an external portal target
    const target = document.createElement("div");
    target.id = "portal-target";
    document.body.appendChild(target);

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Portal child not rendered initially
  await expect(page.locator("#portal-child")).not.toBeAttached();

  // Enable the portal
  await page.evaluate(() => {
    (window as unknown as { setShow: (v: boolean) => void }).setShow(true);
  });

  // Child should appear inside the portal target, not inside #app-root
  await expect(page.locator("#portal-child")).toBeAttached();
  await expect(page.locator("#portal-child")).toHaveText("I am in the portal");

  // Verify it's physically inside #portal-target, not #app-root
  const parentId = await page.evaluate(() => {
    const child = document.getElementById("portal-child");
    let parent = child?.parentElement;
    // Walk up to find the container with an id
    while (parent && !parent.id) parent = parent.parentElement;
    return parent?.id;
  });
  expect(parentId).toBe("portal-target");
});

test("portal children removed when portal is unmounted", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createPortal, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* App() {
      const [show, setShow] = yield* useState(true);
      win.setShow = setShow;
      return createElement(
        "div",
        { id: "app-root" },
        show
          ? createPortal(
              createElement("span", { id: "portal-child" }, "portal content"),
              document.getElementById("portal-target") as Element,
            )
          : null,
      );
    }

    const target = document.createElement("div");
    target.id = "portal-target";
    document.body.appendChild(target);

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#portal-child")).toBeAttached();

  // Hide the portal
  await page.evaluate(() => {
    (window as unknown as { setShow: (v: boolean) => void }).setShow(false);
  });

  await expect(page.locator("#portal-child")).not.toBeAttached();
});

test("portal events work (click handler)", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createPortal, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* Counter() {
      const [count, setCount] = yield* useState(0);
      return createElement(
        "button",
        { id: "portal-btn", onclick: () => setCount((c: number) => c + 1) },
        String(count),
      );
    }

    function* App() {
      return createElement(
        "div",
        { id: "app-root" },
        createPortal(
          createElement(Counter as never, {}),
          document.getElementById("portal-target") as Element,
        ),
      );
    }

    const target = document.createElement("div");
    target.id = "portal-target";
    document.body.appendChild(target);

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#portal-btn")).toHaveText("0");

  await page.click("#portal-btn");
  await expect(page.locator("#portal-btn")).toHaveText("1");

  await page.click("#portal-btn");
  await page.click("#portal-btn");
  await expect(page.locator("#portal-btn")).toHaveText("3");
});

test("portal inherits context from component tree", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createContext, createPortal, render, useContext, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const ThemeCtx = createContext("light");
    const win = window as unknown as Record<string, unknown>;

    function* ThemeReader() {
      const theme = yield* useContext(ThemeCtx);
      return createElement("span", { id: "ctx-value" }, theme);
    }

    function* App() {
      const [theme, setTheme] = yield* useState("light");
      win.setTheme = setTheme;
      return createElement(
        ThemeCtx.Provider as never,
        { value: theme },
        createElement("span", { id: "app-label" }, "App"),
        createPortal(
          createElement(ThemeReader as never, {}),
          document.getElementById("portal-target") as Element,
        ),
      );
    }

    const target = document.createElement("div");
    target.id = "portal-target";
    document.body.appendChild(target);

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially reads "light" from context
  await expect(page.locator("#ctx-value")).toHaveText("light");

  // Change context value
  await page.evaluate(() => {
    (window as unknown as { setTheme: (v: string) => void }).setTheme("dark");
  });

  // Portal child should reflect updated context
  await expect(page.locator("#ctx-value")).toHaveText("dark");
});

test("multiple portals to different containers", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, createPortal, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    function* App() {
      return createElement(
        "div",
        { id: "app-root" },
        createPortal(
          createElement("span", { id: "child-a" }, "Portal A"),
          document.getElementById("target-a") as Element,
        ),
        createPortal(
          createElement("span", { id: "child-b" }, "Portal B"),
          document.getElementById("target-b") as Element,
        ),
      );
    }

    const targetA = document.createElement("div");
    targetA.id = "target-a";
    document.body.appendChild(targetA);

    const targetB = document.createElement("div");
    targetB.id = "target-b";
    document.body.appendChild(targetB);

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#child-a")).toHaveText("Portal A");
  await expect(page.locator("#child-b")).toHaveText("Portal B");

  // Verify each child is in the correct container
  const parentA = await page.evaluate(() => {
    const child = document.getElementById("child-a");
    let parent = child?.parentElement;
    while (parent && !parent.id) parent = parent.parentElement;
    return parent?.id;
  });
  const parentB = await page.evaluate(() => {
    const child = document.getElementById("child-b");
    let parent = child?.parentElement;
    while (parent && !parent.id) parent = parent.parentElement;
    return parent?.id;
  });

  expect(parentA).toBe("target-a");
  expect(parentB).toBe("target-b");
});
