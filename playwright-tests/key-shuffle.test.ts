/**
 * Visual tests for keyed reconciliation ($key prop): reordering, adding,
 * removing, remounting, shuffling, and DOM identity preservation.
 */
import { expect, test } from "./fixtures";

// ── 1. Keyed items preserve state when reordered (reverse order) ──

test("keyed items preserve counter state when reversed", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Counter({ id }: { id: string }) {
      const [count, setCount] = yield* useState(0);
      win[`inc_${id}`] = () => setCount((c: number) => c + 1);
      return createElement("div", { "data-id": id }, `${id}:${count}`);
    }

    function* App() {
      const [order, setOrder] = yield* useState(["a", "b", "c"]);
      win.setOrder = setOrder;
      return createElement(
        "ul",
        { id: "list" },
        ...order.map((id) => createElement(Counter as never, { $key: id, id })),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Increment counters to build state: a=3, b=1, c=2
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_a());
  }
  await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_b());
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_c());
  }

  await expect(page.locator('[data-id="a"]')).toHaveText("a:3");
  await expect(page.locator('[data-id="b"]')).toHaveText("b:1");
  await expect(page.locator('[data-id="c"]')).toHaveText("c:2");

  // Reverse order
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setOrder(["c", "b", "a"]),
  );

  // State preserved after reversal
  await expect(page.locator('[data-id="a"]')).toHaveText("a:3");
  await expect(page.locator('[data-id="b"]')).toHaveText("b:1");
  await expect(page.locator('[data-id="c"]')).toHaveText("c:2");

  // DOM order is reversed
  const ids = await page
    .locator("#list > *")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-id")));
  expect(ids).toEqual(["c", "b", "a"]);
});

// ── 2. Adding a new keyed item doesn't affect existing items' state ──

test("adding a new keyed item preserves existing state", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Counter({ id }: { id: string }) {
      const [count, setCount] = yield* useState(0);
      win[`inc_${id}`] = () => setCount((c: number) => c + 1);
      return createElement("span", { "data-id": id }, `${id}:${count}`);
    }

    function* App() {
      const [items, setItems] = yield* useState(["x", "y"]);
      win.setItems = setItems;
      return createElement(
        "div",
        { id: "container" },
        ...items.map((id) => createElement(Counter as never, { $key: id, id })),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Build state: x=5, y=2
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_x());
  }
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_y());
  }

  await expect(page.locator('[data-id="x"]')).toHaveText("x:5");
  await expect(page.locator('[data-id="y"]')).toHaveText("y:2");

  // Add a new item "z" in the middle
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setItems(["x", "z", "y"]),
  );

  // Existing state preserved
  await expect(page.locator('[data-id="x"]')).toHaveText("x:5");
  await expect(page.locator('[data-id="y"]')).toHaveText("y:2");
  // New item starts at 0
  await expect(page.locator('[data-id="z"]')).toHaveText("z:0");

  // New item works
  await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_z());
  await expect(page.locator('[data-id="z"]')).toHaveText("z:1");
});

// ── 3. Removing a keyed item doesn't affect remaining items' state ──

test("removing a keyed item preserves remaining state", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Counter({ id }: { id: string }) {
      const [count, setCount] = yield* useState(0);
      win[`inc_${id}`] = () => setCount((c: number) => c + 1);
      return createElement("div", { "data-id": id }, `${id}:${count}`);
    }

    function* App() {
      const [items, setItems] = yield* useState(["a", "b", "c"]);
      win.setItems = setItems;
      return createElement(
        "div",
        { id: "container" },
        ...items.map((id) => createElement(Counter as never, { $key: id, id })),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Build state: a=1, b=7, c=3
  await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_a());
  for (let i = 0; i < 7; i++) {
    await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_b());
  }
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_c());
  }

  await expect(page.locator('[data-id="b"]')).toHaveText("b:7");

  // Remove "b" from the middle
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setItems(["a", "c"]),
  );

  // Remaining items preserve state
  await expect(page.locator('[data-id="a"]')).toHaveText("a:1");
  await expect(page.locator('[data-id="c"]')).toHaveText("c:3");
  // "b" is gone
  await expect(page.locator('[data-id="b"]')).toHaveCount(0);

  // Remaining items still work
  await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_c());
  await expect(page.locator('[data-id="c"]')).toHaveText("c:4");
});

// ── 4. Key change causes remount (state resets) ──

test("key change causes remount and state reset", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Counter(_: object) {
      const [count, setCount] = yield* useState(0);
      win.inc = () => setCount((c: number) => c + 1);
      return createElement("span", { id: "counter" }, String(count));
    }

    function* App() {
      const [key, setKey] = yield* useState("key-1");
      win.setKey = setKey;
      return createElement("div", null, createElement(Counter as never, { $key: key }));
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Build up state
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => (window as unknown as Record<string, () => void>).inc());
  }
  await expect(page.locator("#counter")).toHaveText("4");

  // Change key — component should remount, state resets to 0
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string) => void>).setKey("key-2"),
  );
  await expect(page.locator("#counter")).toHaveText("0");

  // Component still works after remount
  await page.evaluate(() => (window as unknown as Record<string, () => void>).inc());
  await expect(page.locator("#counter")).toHaveText("1");
});

// ── 5. Shuffle: random reorder preserves all states ──

test("shuffle preserves all keyed item states", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Counter({ id }: { id: string }) {
      const [count, setCount] = yield* useState(0);
      win[`inc_${id}`] = () => setCount((c: number) => c + 1);
      return createElement("div", { "data-id": id }, `${id}:${count}`);
    }

    function* App() {
      const [order, setOrder] = yield* useState(["p", "q", "r", "s", "t"]);
      win.setOrder = setOrder;
      return createElement(
        "div",
        { id: "list" },
        ...order.map((id) => createElement(Counter as never, { $key: id, id })),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Build distinct state for each: p=1, q=2, r=3, s=4, t=5
  const items = ["p", "q", "r", "s", "t"];
  for (let i = 0; i < items.length; i++) {
    const id = items[i];
    for (let j = 0; j <= i; j++) {
      await page.evaluate(
        (itemId) => (window as unknown as Record<string, () => void>)[`inc_${itemId}`](),
        id,
      );
    }
  }

  for (let i = 0; i < items.length; i++) {
    await expect(page.locator(`[data-id="${items[i]}"]`)).toHaveText(`${items[i]}:${i + 1}`);
  }

  // Shuffle: t, r, p, s, q
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setOrder([
      "t",
      "r",
      "p",
      "s",
      "q",
    ]),
  );

  // All states preserved
  for (let i = 0; i < items.length; i++) {
    await expect(page.locator(`[data-id="${items[i]}"]`)).toHaveText(`${items[i]}:${i + 1}`);
  }

  // Verify DOM order
  const ids = await page
    .locator("#list > *")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-id")));
  expect(ids).toEqual(["t", "r", "p", "s", "q"]);
});

// ── 6. Keyed HTML elements: reorder preserves DOM identity ──

test("keyed HTML elements preserve DOM identity on reorder", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* App() {
      const [order, setOrder] = yield* useState(["red", "green", "blue"]);
      win.setOrder = setOrder;
      return createElement(
        "ul",
        { id: "colors" },
        ...order.map((color) =>
          createElement("li", { $key: color, "data-color": color, id: `li-${color}` }, color),
        ),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Tag each DOM node with a custom attribute to track identity
  await page.evaluate(() => {
    const lis = document.querySelectorAll("#colors li");
    lis.forEach((li, i) => {
      li.setAttribute("data-identity", String(i));
    });
  });

  // Verify initial identities
  await expect(page.locator("#li-red")).toHaveAttribute("data-identity", "0");
  await expect(page.locator("#li-green")).toHaveAttribute("data-identity", "1");
  await expect(page.locator("#li-blue")).toHaveAttribute("data-identity", "2");

  // Reorder: blue, red, green
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setOrder(["blue", "red", "green"]),
  );

  // DOM identity preserved — data-identity attribute stays with original node
  await expect(page.locator("#li-red")).toHaveAttribute("data-identity", "0");
  await expect(page.locator("#li-green")).toHaveAttribute("data-identity", "1");
  await expect(page.locator("#li-blue")).toHaveAttribute("data-identity", "2");

  // DOM order is updated
  const colors = await page
    .locator("#colors > li")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-color")));
  expect(colors).toEqual(["blue", "red", "green"]);
});

// ── 7. Keyed generator components: reorder preserves component state ──

test("keyed generator components preserve state on reorder", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* StatefulItem({ id }: { id: string }) {
      const [text, setText] = yield* useState(`initial-${id}`);
      win[`setText_${id}`] = setText;
      return createElement("div", { "data-id": id, className: "item" }, text);
    }

    function* App() {
      const [order, setOrder] = yield* useState(["m", "n", "o"]);
      win.setOrder = setOrder;
      return createElement(
        "div",
        { id: "wrapper" },
        ...order.map((id) => createElement(StatefulItem as never, { $key: id, id })),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Verify initial state
  await expect(page.locator('[data-id="m"]')).toHaveText("initial-m");
  await expect(page.locator('[data-id="n"]')).toHaveText("initial-n");
  await expect(page.locator('[data-id="o"]')).toHaveText("initial-o");

  // Mutate state of each component
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string) => void>).setText_m("modified-m"),
  );
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string) => void>).setText_n("modified-n"),
  );

  await expect(page.locator('[data-id="m"]')).toHaveText("modified-m");
  await expect(page.locator('[data-id="n"]')).toHaveText("modified-n");
  await expect(page.locator('[data-id="o"]')).toHaveText("initial-o");

  // Reorder: o, m, n
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setOrder(["o", "m", "n"]),
  );

  // State preserved
  await expect(page.locator('[data-id="m"]')).toHaveText("modified-m");
  await expect(page.locator('[data-id="n"]')).toHaveText("modified-n");
  await expect(page.locator('[data-id="o"]')).toHaveText("initial-o");

  // State setters still work after reorder
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string) => void>).setText_o("modified-o"),
  );
  await expect(page.locator('[data-id="o"]')).toHaveText("modified-o");
});

// ── 8. Mixed: some items removed, some added, some reordered ──

test("mixed add/remove/reorder preserves correct states", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Counter({ id }: { id: string }) {
      const [count, setCount] = yield* useState(0);
      win[`inc_${id}`] = () => setCount((c: number) => c + 1);
      return createElement("span", { "data-id": id }, `${id}:${count}`);
    }

    function* App() {
      const [items, setItems] = yield* useState(["a", "b", "c", "d"]);
      win.setItems = setItems;
      return createElement(
        "div",
        { id: "mixed" },
        ...items.map((id) => createElement(Counter as never, { $key: id, id })),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Build state: a=2, b=4, c=1, d=3
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_a());
  }
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_b());
  }
  await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_c());
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_d());
  }

  await expect(page.locator('[data-id="a"]')).toHaveText("a:2");
  await expect(page.locator('[data-id="b"]')).toHaveText("b:4");
  await expect(page.locator('[data-id="c"]')).toHaveText("c:1");
  await expect(page.locator('[data-id="d"]')).toHaveText("d:3");

  // Mixed operation: remove b and c, add e and f, reorder: d, e, a, f
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setItems(["d", "e", "a", "f"]),
  );

  // Preserved items keep their state
  await expect(page.locator('[data-id="a"]')).toHaveText("a:2");
  await expect(page.locator('[data-id="d"]')).toHaveText("d:3");

  // Removed items are gone
  await expect(page.locator('[data-id="b"]')).toHaveCount(0);
  await expect(page.locator('[data-id="c"]')).toHaveCount(0);

  // New items start at 0
  await expect(page.locator('[data-id="e"]')).toHaveText("e:0");
  await expect(page.locator('[data-id="f"]')).toHaveText("f:0");

  // Verify DOM order
  const ids = await page
    .locator("#mixed > *")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-id")));
  expect(ids).toEqual(["d", "e", "a", "f"]);

  // All items still functional
  await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_e());
  await expect(page.locator('[data-id="e"]')).toHaveText("e:1");
  await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_a());
  await expect(page.locator('[data-id="a"]')).toHaveText("a:3");
});

// ── 9. Duplicate avoidance: items with unique keys maintain identity ──

test("items with unique keys maintain identity across updates", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Item({ id }: { id: string }) {
      const [value, setValue] = yield* useState(`val-${id}`);
      win[`set_${id}`] = setValue;
      return createElement("li", { "data-id": id }, value);
    }

    function* App() {
      const [items, setItems] = yield* useState(["k1", "k2", "k3", "k4"]);
      win.setItems = setItems;
      return createElement(
        "ol",
        { id: "unique-list" },
        ...items.map((id) => createElement(Item as never, { $key: id, id })),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Mutate state for k1 and k3
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string) => void>).set_k1("changed-k1"),
  );
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string) => void>).set_k3("changed-k3"),
  );

  await expect(page.locator('[data-id="k1"]')).toHaveText("changed-k1");
  await expect(page.locator('[data-id="k2"]')).toHaveText("val-k2");
  await expect(page.locator('[data-id="k3"]')).toHaveText("changed-k3");
  await expect(page.locator('[data-id="k4"]')).toHaveText("val-k4");

  // Multiple sequential updates that keep keys unique
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setItems(["k4", "k1", "k3", "k2"]),
  );
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setItems(["k2", "k3", "k1", "k4"]),
  );

  // State still preserved after multiple reorders
  await expect(page.locator('[data-id="k1"]')).toHaveText("changed-k1");
  await expect(page.locator('[data-id="k2"]')).toHaveText("val-k2");
  await expect(page.locator('[data-id="k3"]')).toHaveText("changed-k3");
  await expect(page.locator('[data-id="k4"]')).toHaveText("val-k4");

  // DOM order matches last setItems call
  const ids = await page
    .locator("#unique-list > *")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-id")));
  expect(ids).toEqual(["k2", "k3", "k1", "k4"]);
});

// ── 10. Empty to populated: adding first keyed items ──

test("empty to populated: adding first keyed items", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* Counter({ id }: { id: string }) {
      const [count, setCount] = yield* useState(0);
      win[`inc_${id}`] = () => setCount((c: number) => c + 1);
      return createElement("div", { "data-id": id }, `${id}:${count}`);
    }

    function* App() {
      const [items, setItems] = yield* useState<string[]>([]);
      win.setItems = setItems;
      return createElement(
        "div",
        { id: "empty-start" },
        ...items.map((id) => createElement(Counter as never, { $key: id, id })),
      );
    }

    render(createElement(App as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Initially empty
  await expect(page.locator("#empty-start > *")).toHaveCount(0);

  // Add first batch of items
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setItems(["w", "x"]),
  );

  await expect(page.locator('[data-id="w"]')).toHaveText("w:0");
  await expect(page.locator('[data-id="x"]')).toHaveText("x:0");

  // Build some state
  await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_w());
  await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_w());
  await page.evaluate(() => (window as unknown as Record<string, () => void>).inc_x());

  await expect(page.locator('[data-id="w"]')).toHaveText("w:2");
  await expect(page.locator('[data-id="x"]')).toHaveText("x:1");

  // Add more items while keeping existing
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setItems(["w", "y", "x", "z"]),
  );

  // Existing state preserved
  await expect(page.locator('[data-id="w"]')).toHaveText("w:2");
  await expect(page.locator('[data-id="x"]')).toHaveText("x:1");
  // New items start at 0
  await expect(page.locator('[data-id="y"]')).toHaveText("y:0");
  await expect(page.locator('[data-id="z"]')).toHaveText("z:0");

  // Back to empty
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setItems([]),
  );
  await expect(page.locator("#empty-start > *")).toHaveCount(0);

  // Re-add — state should be fresh (components were unmounted)
  await page.evaluate(() =>
    (window as unknown as Record<string, (v: string[]) => void>).setItems(["w"]),
  );
  await expect(page.locator('[data-id="w"]')).toHaveText("w:0");
});
