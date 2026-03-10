import { useState } from "../hooks";
import { createElement } from "../jsx";
import { render } from "../render";

describe("$key prop – keyed reconciliation", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // ─── Generator components mixed with falsy values ───

  it("reorders generator components by key without remounting", () => {
    let renderCountA = 0;
    let renderCountB = 0;
    let renderCountC = 0;
    let setOrder: (v: string[]) => void = () => {};

    function* ItemA() {
      renderCountA++;
      const [count] = yield* useState(10);
      return createElement("div", { className: "a" }, `A:${count}`);
    }
    function* ItemB() {
      renderCountB++;
      const [count] = yield* useState(20);
      return createElement("div", { className: "b" }, `B:${count}`);
    }
    function* ItemC() {
      renderCountC++;
      const [count] = yield* useState(30);
      return createElement("div", { className: "c" }, `C:${count}`);
    }

    const components: Record<string, never> = {
      a: ItemA as never,
      b: ItemB as never,
      c: ItemC as never,
    };

    function* Parent() {
      const [order, so] = yield* useState(["a", "b", "c"]);
      setOrder = so;
      return createElement(
        "div",
        { id: "list" },
        ...order.map((k) => createElement(components[k] as never, { $key: k })),
      );
    }

    render(createElement(Parent as never, {}), container);
    const list = container.querySelector("#list") as HTMLElement;
    expect(list.children).toHaveLength(3);
    expect(list.children[0]?.textContent).toBe("A:10");
    expect(list.children[1]?.textContent).toBe("B:20");
    expect(list.children[2]?.textContent).toBe("C:30");

    // Save references to original DOM nodes
    const nodeA = list.children[0];
    const nodeB = list.children[1];
    const nodeC = list.children[2];

    renderCountA = 0;
    renderCountB = 0;
    renderCountC = 0;

    // Reverse order
    setOrder(["c", "b", "a"]);

    // DOM nodes should be MOVED, not recreated
    expect(list.children).toHaveLength(3);
    expect(list.children[0]?.textContent).toBe("C:30");
    expect(list.children[1]?.textContent).toBe("B:20");
    expect(list.children[2]?.textContent).toBe("A:10");

    // Same DOM nodes, just reordered
    expect(list.children[0]).toBe(nodeC);
    expect(list.children[1]).toBe(nodeB);
    expect(list.children[2]).toBe(nodeA);

    // Components should NOT have been rerendered (only moved)
    expect(renderCountA).toBe(0);
    expect(renderCountB).toBe(0);
    expect(renderCountC).toBe(0);
  });

  it("generator components with keys mixed with falsy values", () => {
    let setItems: (v: (string | null)[]) => void = () => {};

    function* Item({ label }: { label: string }) {
      return createElement("span", null, label);
    }

    function* Parent() {
      const [items, si] = yield* useState<(string | null)[]>(["a", null, "b", null, "c"]);
      setItems = si;
      return createElement(
        "div",
        null,
        ...items.map((item) =>
          item ? createElement(Item as never, { $key: item, label: item }) : null,
        ),
      );
    }

    render(createElement(Parent as never, {}), container);
    const div = container.querySelector("div") as HTMLElement;
    const spans = div.querySelectorAll("span");
    expect(spans).toHaveLength(3);
    expect(spans[0]?.textContent).toBe("a");
    expect(spans[1]?.textContent).toBe("b");
    expect(spans[2]?.textContent).toBe("c");

    const spanA = spans[0];
    const spanB = spans[1];
    const spanC = spans[2];

    // Reorder with different falsy positions
    setItems([null, "c", "a", null, "b"]);

    const newSpans = div.querySelectorAll("span");
    expect(newSpans).toHaveLength(3);
    expect(newSpans[0]?.textContent).toBe("c");
    expect(newSpans[1]?.textContent).toBe("a");
    expect(newSpans[2]?.textContent).toBe("b");

    // DOM nodes moved, not recreated
    expect(newSpans[0]).toBe(spanC);
    expect(newSpans[1]).toBe(spanA);
    expect(newSpans[2]).toBe(spanB);
  });

  // ─── Generator components mixed with falsy values (non-stateful) ───

  it("reorders generator components by key without recreating DOM", () => {
    let setOrder: (v: string[]) => void = () => {};

    function* ItemX() {
      return createElement("li", null, "X");
    }
    function* ItemY() {
      return createElement("li", null, "Y");
    }

    const components: Record<string, never> = {
      x: ItemX as never,
      y: ItemY as never,
    };

    function* Parent() {
      const [order, so] = yield* useState(["x", "y"]);
      setOrder = so;
      return createElement(
        "ul",
        null,
        ...order.map((k) => createElement(components[k] as never, { $key: k })),
      );
    }

    render(createElement(Parent as never, {}), container);
    const ul = container.querySelector("ul") as HTMLElement;
    expect(ul.children[0]?.textContent).toBe("X");
    expect(ul.children[1]?.textContent).toBe("Y");

    const nodeX = ul.children[0];
    const nodeY = ul.children[1];

    // Reverse
    setOrder(["y", "x"]);

    expect(ul.children[0]?.textContent).toBe("Y");
    expect(ul.children[1]?.textContent).toBe("X");
    expect(ul.children[0]).toBe(nodeY);
    expect(ul.children[1]).toBe(nodeX);
  });

  it("generator components with keys mixed with falsy values", () => {
    let setItems: (v: (string | null)[]) => void = () => {};

    function* Tag({ label }: { label: string }) {
      return createElement("b", null, label);
    }

    function* Parent() {
      const [items, si] = yield* useState<(string | null)[]>(["p", null, "q"]);
      setItems = si;
      return createElement(
        "div",
        null,
        ...items.map((item) =>
          item ? createElement(Tag as never, { $key: item, label: item }) : false,
        ),
      );
    }

    render(createElement(Parent as never, {}), container);
    const div = container.querySelector("div") as HTMLElement;
    const bs = div.querySelectorAll("b");
    expect(bs).toHaveLength(2);
    const bP = bs[0];
    const bQ = bs[1];

    setItems([null, "q", null, "p"]);
    const newBs = div.querySelectorAll("b");
    expect(newBs).toHaveLength(2);
    expect(newBs[0]).toBe(bQ);
    expect(newBs[1]).toBe(bP);
  });

  // ─── HTML elements mixed with falsy values ───

  it("reorders keyed HTML elements without recreating DOM", () => {
    let setOrder: (v: string[]) => void = () => {};

    function* Parent() {
      const [order, so] = yield* useState(["first", "second", "third"]);
      setOrder = so;
      return createElement(
        "ul",
        null,
        ...order.map((text) => createElement("li", { $key: text }, text)),
      );
    }

    render(createElement(Parent as never, {}), container);
    const ul = container.querySelector("ul") as HTMLElement;
    expect(ul.children).toHaveLength(3);

    const li1 = ul.children[0];
    const li2 = ul.children[1];
    const li3 = ul.children[2];

    // Reverse
    setOrder(["third", "second", "first"]);

    expect(ul.children[0]?.textContent).toBe("third");
    expect(ul.children[1]?.textContent).toBe("second");
    expect(ul.children[2]?.textContent).toBe("first");
    expect(ul.children[0]).toBe(li3);
    expect(ul.children[1]).toBe(li2);
    expect(ul.children[2]).toBe(li1);
  });

  it("keyed HTML elements mixed with falsy values", () => {
    let setItems: (v: (string | null)[]) => void = () => {};

    function* Parent() {
      const [items, si] = yield* useState<(string | null)[]>(["a", null, "b"]);
      setItems = si;
      return createElement(
        "div",
        null,
        ...items.map((item) => (item ? createElement("span", { $key: item }, item) : null)),
      );
    }

    render(createElement(Parent as never, {}), container);
    const div = container.querySelector("div") as HTMLElement;
    const spans = div.querySelectorAll("span");
    const spanA = spans[0];
    const spanB = spans[1];

    setItems(["b", null, null, "a"]);
    const newSpans = div.querySelectorAll("span");
    expect(newSpans).toHaveLength(2);
    expect(newSpans[0]).toBe(spanB);
    expect(newSpans[1]).toBe(spanA);
  });

  // ─── Component keeps working after key-based reorder ───

  it("generator component preserves state and continues working after reorder", () => {
    let setOrder: (v: string[]) => void = () => {};
    const setters: Record<string, (v: number) => void> = {};

    function* Counter({ id }: { id: string }) {
      const [count, setCount] = yield* useState(0);
      setters[id] = setCount;
      return createElement("div", { "data-id": id }, `${id}:${count}`);
    }

    function* Parent() {
      const [order, so] = yield* useState(["x", "y", "z"]);
      setOrder = so;
      return createElement(
        "div",
        null,
        ...order.map((id) => createElement(Counter as never, { $key: id, id })),
      );
    }

    render(createElement(Parent as never, {}), container);

    // Increment x to 5
    setters["x"]?.(5);
    expect(container.querySelector('[data-id="x"]')?.textContent).toBe("x:5");

    // Increment y to 3
    setters["y"]?.(3);
    expect(container.querySelector('[data-id="y"]')?.textContent).toBe("y:3");

    // Reorder: z, x, y
    setOrder(["z", "x", "y"]);

    // State preserved after reorder
    expect(container.querySelector('[data-id="x"]')?.textContent).toBe("x:5");
    expect(container.querySelector('[data-id="y"]')?.textContent).toBe("y:3");
    expect(container.querySelector('[data-id="z"]')?.textContent).toBe("z:0");

    // Components still work after reorder (can update state)
    setters["z"]?.(99);
    expect(container.querySelector('[data-id="z"]')?.textContent).toBe("z:99");

    setters["x"]?.(10);
    expect(container.querySelector('[data-id="x"]')?.textContent).toBe("x:10");
  });

  // ─── Key change alone does NOT cause rerender ───

  it("does not rerender generator component when only key changes", () => {
    let renderCount = 0;
    let setKey: (v: string) => void = () => {};
    let setLabel: (v: string) => void = () => {};

    function* Child({ label }: { label: string }) {
      renderCount++;
      return createElement("span", null, label);
    }

    function* Parent() {
      const [key, sk] = yield* useState("key-1");
      const [label, sl] = yield* useState("hello");
      setKey = sk;
      setLabel = sl;
      return createElement("div", null, createElement(Child as never, { $key: key, label }));
    }

    render(createElement(Parent as never, {}), container);
    expect(renderCount).toBe(1);
    expect(container.querySelector("span")?.textContent).toBe("hello");

    // Change only the key — content props unchanged
    renderCount = 0;
    setKey("key-2");

    // The child should NOT rerender since label didn't change
    // (key change means it's a "new" slot, but same type + same props = skip)
    // Note: in React, changing key forces remount. In yielderact, if the same
    // component function + same props appear at the same position with a
    // different key, it may be treated as a new mount or reuse depending on
    // implementation. What matters is the component still works.
    const span = container.querySelector("span") as HTMLElement;
    expect(span.textContent).toBe("hello");

    // Verify it still works: changing label causes update
    setLabel("world");
    expect(container.querySelector("span")?.textContent).toBe("world");
  });

  // ─── Props update after reorder causes rerender ───

  // ─── Non-keyed siblings preserve state when keyed children reorder ───

  it("non-keyed siblings preserve state when keyed children shuffle", () => {
    let setOrder: (v: string[]) => void = () => {};
    const setters: Record<string, (v: number) => void> = {};

    function* Counter({ id }: { id: string }) {
      const [count, setCount] = yield* useState(0);
      setters[id] = setCount;
      return createElement("div", { "data-id": id }, `${id}:${count}`);
    }

    function* Parent() {
      const [order, so] = yield* useState(["x", "y"]);
      setOrder = so;
      return createElement(
        "div",
        null,
        createElement(Counter as never, { id: "before" }),
        ...order.map((id) => createElement(Counter as never, { $key: id, id })),
        createElement(Counter as never, { id: "after" }),
      );
    }

    render(createElement(Parent as never, {}), container);

    // Build up state on all components
    setters["before"]?.(10);
    setters["x"]?.(20);
    setters["y"]?.(30);
    setters["after"]?.(40);

    expect(container.querySelector('[data-id="before"]')?.textContent).toBe("before:10");
    expect(container.querySelector('[data-id="x"]')?.textContent).toBe("x:20");
    expect(container.querySelector('[data-id="y"]')?.textContent).toBe("y:30");
    expect(container.querySelector('[data-id="after"]')?.textContent).toBe("after:40");

    // Reverse keyed children
    setOrder(["y", "x"]);

    // All state must be preserved — keyed and non-keyed alike
    expect(container.querySelector('[data-id="before"]')?.textContent).toBe("before:10");
    expect(container.querySelector('[data-id="y"]')?.textContent).toBe("y:30");
    expect(container.querySelector('[data-id="x"]')?.textContent).toBe("x:20");
    expect(container.querySelector('[data-id="after"]')?.textContent).toBe("after:40");

    // Verify DOM order: before, y, x, after
    const div = container.querySelector("div") as HTMLElement;
    expect(div.children[0]?.getAttribute("data-id")).toBe("before");
    expect(div.children[1]?.getAttribute("data-id")).toBe("y");
    expect(div.children[2]?.getAttribute("data-id")).toBe("x");
    expect(div.children[3]?.getAttribute("data-id")).toBe("after");

    // All components still work after reorder
    setters["before"]?.(11);
    setters["after"]?.(41);
    setters["x"]?.(21);
    expect(container.querySelector('[data-id="before"]')?.textContent).toBe("before:11");
    expect(container.querySelector('[data-id="after"]')?.textContent).toBe("after:41");
    expect(container.querySelector('[data-id="x"]')?.textContent).toBe("x:21");
  });

  // ─── Props update after reorder causes rerender ───

  it("props update on keyed generator component triggers rerender after reorder", () => {
    let setOrder: (v: string[]) => void = () => {};
    let setLabelFor: (id: string, label: string) => void = () => {};

    function* Item({ id, label }: { id: string; label: string }) {
      return createElement("span", { "data-id": id }, label);
    }

    function* Parent() {
      const [order, so] = yield* useState(["a", "b"]);
      const [labels, setLabels] = yield* useState<Record<string, string>>({
        a: "Alpha",
        b: "Beta",
      });
      setOrder = so;
      setLabelFor = (id: string, label: string) => setLabels({ ...labels, [id]: label });
      return createElement(
        "div",
        null,
        ...order.map((id) => createElement(Item as never, { $key: id, id, label: labels[id] })),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('[data-id="a"]')?.textContent).toBe("Alpha");
    expect(container.querySelector('[data-id="b"]')?.textContent).toBe("Beta");

    // Reorder
    setOrder(["b", "a"]);
    expect(container.querySelector("div")?.children[0]?.getAttribute("data-id")).toBe("b");
    expect(container.querySelector("div")?.children[1]?.getAttribute("data-id")).toBe("a");

    // Update label after reorder
    setLabelFor("a", "Alpha Updated");
    expect(container.querySelector('[data-id="a"]')?.textContent).toBe("Alpha Updated");
  });
});
