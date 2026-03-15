import { _getCtxMap, _getCurrentBatch } from "../context";
import { useState } from "../hooks";
import { createElement } from "../jsx";
import { createRoot } from "../render";

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

describe("createRoot", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders a component into the container", () => {
    function* Greeting({ name }: { name: string }) {
      return createElement("h1", null, `Hello, ${name}!`);
    }
    const root = createRoot(container);
    root.render(createElement(Greeting as never, { name: "World" }));
    expect(container.querySelector("h1")?.textContent).toBe("Hello, World!");
  });

  it("renders a component into the container", () => {
    function* Counter() {
      const [count] = yield* useState(0);
      return createElement("span", null, String(count));
    }
    const root = createRoot(container);
    root.render(createElement(Counter as never, {}));
    expect(container.textContent).toBe("0");
  });

  it('sets $patch context to "default" for the rendered tree', () => {
    let capturedBatch: string | undefined;

    function* Comp() {
      capturedBatch = _getCurrentBatch();
      return createElement("div", null);
    }

    const root = createRoot(container);
    root.render(createElement(Comp as never, {}));
    expect(capturedBatch).toBe("default");
  });

  it("restores context map after render", () => {
    const root = createRoot(container);
    root.render(createElement("div", null));
    // After render completes, the root's context map is restored to its
    // initial state (no leftover Provider values from the rendered tree).
    const after = _getCtxMap();
    expect(after.size).toBe(0);
  });

  it("two independent createRoot calls do not share state", () => {
    const container2 = document.createElement("div");
    document.body.appendChild(container2);

    let setCount1: (v: number | ((p: number) => number)) => void = () => {};
    let setCount2: (v: number | ((p: number) => number)) => void = () => {};

    function* Counter1() {
      const [count, set] = yield* useState(0);
      setCount1 = set;
      return createElement("span", { id: "c1" }, String(count));
    }

    function* Counter2() {
      const [count, set] = yield* useState(100);
      setCount2 = set;
      return createElement("span", { id: "c2" }, String(count));
    }

    const root1 = createRoot(container);
    const root2 = createRoot(container2);
    root1.render(createElement(Counter1 as never, {}));
    root2.render(createElement(Counter2 as never, {}));

    expect(container.querySelector("#c1")?.textContent).toBe("0");
    expect(container2.querySelector("#c2")?.textContent).toBe("100");

    // Update root 1 — root 2 must not be affected.
    setCount1(5);
    expect(container.querySelector("#c1")?.textContent).toBe("5");
    expect(container2.querySelector("#c2")?.textContent).toBe("100");

    // Update root 2 — root 1 must not be affected.
    setCount2(200);
    expect(container.querySelector("#c1")?.textContent).toBe("5");
    expect(container2.querySelector("#c2")?.textContent).toBe("200");

    document.body.removeChild(container2);
  });
});
