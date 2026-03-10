/**
 * Visual tests for the $shown prop: conditional mount/unmount,
 * state reset on remount, sibling preservation, nesting, rapid toggling,
 * and behavior on plain HTML elements vs generator components.
 */
import { expect, test } from "./fixtures";

test("$shown=true mounts element in DOM", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    render(
      createElement(
        "div",
        { id: "container" },
        createElement("span", { id: "target", $shown: true }, "visible"),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.locator("#target")).toBeAttached();
  await expect(page.locator("#target")).toHaveText("visible");
  await page.screenshot({ path: "/tmp/visual-shown-true.png" });
});

test("$shown=false does not mount element", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    render(
      createElement(
        "div",
        { id: "container" },
        createElement("span", { id: "target", $shown: false }, "hidden"),
      ),
      document.getElementById("root") as HTMLElement,
    );
  });

  await expect(page.locator("#target")).not.toBeAttached();
  await expect(page.locator("#container")).toBeAttached();
  await page.screenshot({ path: "/tmp/visual-shown-false.png" });
});

test("toggling $shown=false removes element from DOM", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* App() {
      const [shown, setShown] = yield* useState(true);
      win.setShown = setShown;
      return createElement(
        "div",
        { id: "container" },
        createElement("span", { id: "target", $shown: shown }, "content"),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#target")).toBeAttached();
  await expect(page.locator("#target")).toHaveText("content");

  // Toggle $shown to false
  await page.evaluate(() => {
    (window as unknown as { setShown: (v: boolean) => void }).setShown(false);
  });

  await expect(page.locator("#target")).not.toBeAttached();
  await page.screenshot({ path: "/tmp/visual-shown-toggle-off.png" });
});

test("toggling $shown=true remounts element", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* App() {
      const [shown, setShown] = yield* useState(false);
      win.setShown = setShown;
      return createElement(
        "div",
        { id: "container" },
        createElement("span", { id: "target", $shown: shown }, "remounted"),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially not mounted
  await expect(page.locator("#target")).not.toBeAttached();

  // Toggle $shown to true
  await page.evaluate(() => {
    (window as unknown as { setShown: (v: boolean) => void }).setShown(true);
  });

  await expect(page.locator("#target")).toBeAttached();
  await expect(page.locator("#target")).toHaveText("remounted");
  await page.screenshot({ path: "/tmp/visual-shown-toggle-on.png" });
});

test("generator component state resets on remount after $shown toggle", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Counter() {
      const [count, setCount] = yield* useState(0);
      win.increment = () => setCount((c: number) => c + 1);
      return createElement(
        "button",
        { id: "counter", onclick: () => setCount((c: number) => c + 1) },
        String(count),
      );
    }

    function* App() {
      const [shown, setShown] = yield* useState(true);
      win.setShown = setShown;
      return createElement(
        "div",
        { id: "container" },
        createElement(Counter as never, { $shown: shown }),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Increment state to 3
  await expect(page.locator("#counter")).toHaveText("0");
  await page.click("#counter");
  await page.click("#counter");
  await page.click("#counter");
  await expect(page.locator("#counter")).toHaveText("3");

  // Unmount via $shown=false
  await page.evaluate(() => {
    (window as unknown as { setShown: (v: boolean) => void }).setShown(false);
  });
  await expect(page.locator("#counter")).not.toBeAttached();

  // Remount via $shown=true — state should reset to 0
  await page.evaluate(() => {
    (window as unknown as { setShown: (v: boolean) => void }).setShown(true);
  });
  await expect(page.locator("#counter")).toBeAttached();
  await expect(page.locator("#counter")).toHaveText("0");
  await page.screenshot({ path: "/tmp/visual-shown-state-reset.png" });
});

test("sibling state preserved when one sibling's $shown toggles", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* SiblingA() {
      const [count, setCount] = yield* useState(0);
      win.incrementA = () => setCount((c: number) => c + 1);
      return createElement("span", { id: "sibling-a" }, String(count));
    }

    function* SiblingB() {
      const [count, setCount] = yield* useState(0);
      win.incrementB = () => setCount((c: number) => c + 1);
      return createElement("span", { id: "sibling-b" }, String(count));
    }

    function* App() {
      const [shownA, setShownA] = yield* useState(true);
      win.setShownA = setShownA;
      return createElement(
        "div",
        { id: "container" },
        createElement(SiblingA as never, { $shown: shownA }),
        createElement(SiblingB as never, {}),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Increment both siblings
  await page.evaluate(() => {
    (window as unknown as { incrementA: () => void }).incrementA();
    (window as unknown as { incrementA: () => void }).incrementA();
  });
  await page.evaluate(() => {
    (window as unknown as { incrementB: () => void }).incrementB();
    (window as unknown as { incrementB: () => void }).incrementB();
    (window as unknown as { incrementB: () => void }).incrementB();
  });
  await expect(page.locator("#sibling-a")).toHaveText("2");
  await expect(page.locator("#sibling-b")).toHaveText("3");

  // Hide sibling A
  await page.evaluate(() => {
    (window as unknown as { setShownA: (v: boolean) => void }).setShownA(false);
  });
  await expect(page.locator("#sibling-a")).not.toBeAttached();

  // Sibling B state must be preserved
  await expect(page.locator("#sibling-b")).toHaveText("3");

  // Show sibling A again — its state resets, but B stays
  await page.evaluate(() => {
    (window as unknown as { setShownA: (v: boolean) => void }).setShownA(true);
  });
  await expect(page.locator("#sibling-a")).toHaveText("0");
  await expect(page.locator("#sibling-b")).toHaveText("3");
  await page.screenshot({ path: "/tmp/visual-shown-sibling-preserved.png" });
});

test("nested $shown: parent false hides children regardless of child $shown", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* App() {
      const [parentShown, setParentShown] = yield* useState(true);
      win.setParentShown = setParentShown;
      return createElement(
        "div",
        { id: "root-container" },
        createElement(
          "div",
          { id: "parent", $shown: parentShown },
          createElement("span", { id: "child-shown", $shown: true }, "child-visible"),
          createElement("span", { id: "child-default" }, "child-default"),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially everything is visible
  await expect(page.locator("#parent")).toBeAttached();
  await expect(page.locator("#child-shown")).toBeAttached();
  await expect(page.locator("#child-default")).toBeAttached();

  // Hide parent — all children must disappear
  await page.evaluate(() => {
    (window as unknown as { setParentShown: (v: boolean) => void }).setParentShown(false);
  });
  await expect(page.locator("#parent")).not.toBeAttached();
  await expect(page.locator("#child-shown")).not.toBeAttached();
  await expect(page.locator("#child-default")).not.toBeAttached();

  // Show parent again — children come back
  await page.evaluate(() => {
    (window as unknown as { setParentShown: (v: boolean) => void }).setParentShown(true);
  });
  await expect(page.locator("#parent")).toBeAttached();
  await expect(page.locator("#child-shown")).toBeAttached();
  await expect(page.locator("#child-default")).toBeAttached();
  await page.screenshot({ path: "/tmp/visual-shown-nested.png" });
});

test("initial $shown=false: component never mounts until toggled true", async ({
  page,
  setupPage,
}) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;
    win.mountCount = 0;

    function* LazyComponent() {
      (window as unknown as Record<string, number>).mountCount++;
      return createElement("span", { id: "lazy" }, "I mounted!");
    }

    function* App() {
      const [shown, setShown] = yield* useState(false);
      win.setShown = setShown;
      return createElement(
        "div",
        { id: "container" },
        createElement(LazyComponent as never, { $shown: shown }),
        createElement("span", { id: "marker" }, "app-loaded"),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // App is loaded but lazy component is not mounted
  await expect(page.locator("#marker")).toHaveText("app-loaded");
  await expect(page.locator("#lazy")).not.toBeAttached();

  // Verify the generator never ran
  const mountCountBefore = await page.evaluate(
    () => (window as unknown as Record<string, number>).mountCount,
  );
  expect(mountCountBefore).toBe(0);

  // Toggle shown to true — component mounts for the first time
  await page.evaluate(() => {
    (window as unknown as { setShown: (v: boolean) => void }).setShown(true);
  });
  await expect(page.locator("#lazy")).toBeAttached();
  await expect(page.locator("#lazy")).toHaveText("I mounted!");

  const mountCountAfter = await page.evaluate(
    () => (window as unknown as Record<string, number>).mountCount,
  );
  expect(mountCountAfter).toBe(1);
  await page.screenshot({ path: "/tmp/visual-shown-initial-false.png" });
});

test("rapid $shown toggling (fast mount/unmount cycles)", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Counter() {
      const [count] = yield* useState(0);
      return createElement("span", { id: "rapid-target" }, String(count));
    }

    function* App() {
      const [shown, setShown] = yield* useState(true);
      win.setShown = setShown;
      return createElement(
        "div",
        { id: "container" },
        createElement(Counter as never, { $shown: shown }),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  await expect(page.locator("#rapid-target")).toBeAttached();

  // Rapidly toggle $shown multiple times
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      (window as unknown as { setShown: (v: boolean) => void }).setShown(false);
    });
    await page.evaluate(() => {
      (window as unknown as { setShown: (v: boolean) => void }).setShown(true);
    });
  }

  // After rapid toggling, element should be mounted and stable
  await expect(page.locator("#rapid-target")).toBeAttached();
  await expect(page.locator("#rapid-target")).toHaveText("0");

  // Final toggle to false
  await page.evaluate(() => {
    (window as unknown as { setShown: (v: boolean) => void }).setShown(false);
  });
  await expect(page.locator("#rapid-target")).not.toBeAttached();

  // And back to true
  await page.evaluate(() => {
    (window as unknown as { setShown: (v: boolean) => void }).setShown(true);
  });
  await expect(page.locator("#rapid-target")).toBeAttached();
  await expect(page.locator("#rapid-target")).toHaveText("0");
  await page.screenshot({ path: "/tmp/visual-shown-rapid-toggle.png" });
});

test("$shown on plain HTML elements vs generator components", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* GenComponent() {
      const [count, setCount] = yield* useState(0);
      win.incrementGen = () => setCount((c: number) => c + 1);
      return createElement("span", { id: "gen-component" }, `gen:${count}`);
    }

    function* App() {
      const [htmlShown, setHtmlShown] = yield* useState(true);
      const [genShown, setGenShown] = yield* useState(true);
      win.setHtmlShown = setHtmlShown;
      win.setGenShown = setGenShown;
      return createElement(
        "div",
        { id: "container" },
        createElement("div", { id: "html-el", $shown: htmlShown }, "plain-html"),
        createElement(GenComponent as never, { $shown: genShown }),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Both visible initially
  await expect(page.locator("#html-el")).toBeAttached();
  await expect(page.locator("#html-el")).toHaveText("plain-html");
  await expect(page.locator("#gen-component")).toBeAttached();
  await expect(page.locator("#gen-component")).toHaveText("gen:0");

  // Increment gen component state
  await page.evaluate(() => {
    (window as unknown as { incrementGen: () => void }).incrementGen();
  });
  await expect(page.locator("#gen-component")).toHaveText("gen:1");

  // Hide HTML element — generator stays
  await page.evaluate(() => {
    (window as unknown as { setHtmlShown: (v: boolean) => void }).setHtmlShown(false);
  });
  await expect(page.locator("#html-el")).not.toBeAttached();
  await expect(page.locator("#gen-component")).toHaveText("gen:1");

  // Show HTML element again
  await page.evaluate(() => {
    (window as unknown as { setHtmlShown: (v: boolean) => void }).setHtmlShown(true);
  });
  await expect(page.locator("#html-el")).toBeAttached();
  await expect(page.locator("#html-el")).toHaveText("plain-html");

  // Hide generator component — HTML stays
  await page.evaluate(() => {
    (window as unknown as { setGenShown: (v: boolean) => void }).setGenShown(false);
  });
  await expect(page.locator("#gen-component")).not.toBeAttached();
  await expect(page.locator("#html-el")).toBeAttached();

  // Show generator component — state resets to 0
  await page.evaluate(() => {
    (window as unknown as { setGenShown: (v: boolean) => void }).setGenShown(true);
  });
  await expect(page.locator("#gen-component")).toBeAttached();
  await expect(page.locator("#gen-component")).toHaveText("gen:0");
  await page.screenshot({ path: "/tmp/visual-shown-html-vs-gen.png" });
});
