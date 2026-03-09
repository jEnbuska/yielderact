import { _getCtxMap, _getCurrentBatch } from "../context";
import { $patchContext, $state } from "../hooks";
import { createElement } from "../jsx";
import { createRoot, render } from "../render";

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

  it("renders a plain component into the container", () => {
    function Greeting({ name }: { name: string }) {
      return createElement("h1", null, `Hello, ${name}!`);
    }
    const root = createRoot(container);
    root.render(createElement(Greeting as never, { name: "World" }));
    expect(container.querySelector("h1")!.textContent).toBe("Hello, World!");
  });

  it("renders a generator component into the container", () => {
    function* Counter() {
      const [count] = yield* $state(0);
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

    let setCount1: ((v: number | ((p: number) => number)) => void) | null = null;
    let setCount2: ((v: number | ((p: number) => number)) => void) | null = null;

    function* Counter1() {
      const [count, set] = yield* $state(0);
      setCount1 = set;
      return createElement("span", { id: "c1" }, String(count));
    }

    function* Counter2() {
      const [count, set] = yield* $state(100);
      setCount2 = set;
      return createElement("span", { id: "c2" }, String(count));
    }

    const root1 = createRoot(container);
    const root2 = createRoot(container2);
    root1.render(createElement(Counter1 as never, {}));
    root2.render(createElement(Counter2 as never, {}));

    expect(container.querySelector("#c1")!.textContent).toBe("0");
    expect(container2.querySelector("#c2")!.textContent).toBe("100");

    // Update root 1 — root 2 must not be affected.
    setCount1!(5);
    expect(container.querySelector("#c1")!.textContent).toBe("5");
    expect(container2.querySelector("#c2")!.textContent).toBe("100");

    // Update root 2 — root 1 must not be affected.
    setCount2!(200);
    expect(container.querySelector("#c1")!.textContent).toBe("5");
    expect(container2.querySelector("#c2")!.textContent).toBe("200");

    document.body.removeChild(container2);
  });
});

describe("$patchContext", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('returns "default" when rendered under createRoot', () => {
    let patchValue: "live" | "default" | undefined;

    function* Comp() {
      patchValue = yield* $patchContext();
      return createElement("div", null);
    }

    const root = createRoot(container);
    root.render(createElement(Comp as never, {}));
    expect(patchValue).toBe("default");
  });

  it('returns "live" inside a $patch="live" parent element', () => {
    let patchValue: "live" | "default" | undefined;

    function* Child() {
      patchValue = yield* $patchContext();
      return createElement("span", null, patchValue);
    }

    const root = createRoot(container);
    root.render(createElement("div", { $patch: "live" }, createElement(Child as never, {})));
    expect(patchValue).toBe("live");
  });

  it('returns "live" for a component with $patch="live"', () => {
    let patchValue: "live" | "default" | undefined;

    function* Comp() {
      patchValue = yield* $patchContext();
      return createElement("div", null);
    }

    const root = createRoot(container);
    root.render(createElement(Comp as never, { $patch: "live" }));
    expect(patchValue).toBe("live");
  });

  it("rerenders when inherited batch changes", () => {
    let setLive: ((v: boolean) => void) | null = null;
    let patchValue: "live" | "default" | undefined;

    function* Child() {
      patchValue = yield* $patchContext();
      return createElement("span", { id: "patch" }, patchValue);
    }

    function* Parent() {
      const [live, setLive_] = yield* $state(false);
      setLive = setLive_;
      return createElement(
        "div",
        { $patch: live ? "live" : "default" },
        createElement(Child as never, {}),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(patchValue).toBe("default");
    expect(container.querySelector("#patch")!.textContent).toBe("default");

    setLive!(true);
    expect(patchValue).toBe("live");
    expect(container.querySelector("#patch")!.textContent).toBe("live");
  });

  it("works the same as $context(ThemeContext) pattern", () => {
    // Verify $patchContext follows the exact same usage pattern as
    // $context — read via yield* inside a generator component.
    let patchValue: "live" | "default" | undefined;

    function* Reader() {
      const patch = yield* $patchContext();
      patchValue = patch;
      return createElement("div", null, patch);
    }

    const root = createRoot(container);
    root.render(createElement(Reader as never, {}));
    expect(patchValue).toBe("default");
    expect(container.textContent).toBe("default");
  });

  it("does not rerender when only $patch prop changes (no $patchContext)", () => {
    let renderCount = 0;
    let setPatch: ((v: "live" | "default") => void) | null = null;

    function* Child({ label }: { label: string; $patch?: string }) {
      yield* $state(0); // just to make it a stateful generator component
      renderCount++;
      return createElement("span", { id: "child" }, label);
    }

    function* Parent() {
      const [patch, sp] = yield* $state<"live" | "default">("default");
      setPatch = sp;
      return createElement(Child as never, { label: "hello", $patch: patch });
    }

    render(createElement(Parent as never, {}), container);
    expect(renderCount).toBe(1);
    expect(container.querySelector("#child")!.textContent).toBe("hello");

    // Change only $patch — Child should NOT rerender
    setPatch!("live");
    expect(renderCount).toBe(1);
    expect(container.querySelector("#child")!.textContent).toBe("hello");
  });

  it("rerenders when $patch changes and component consumes $patchContext", () => {
    let renderCount = 0;
    let setPatch: ((v: "live" | "default") => void) | null = null;
    let patchValue: "live" | "default" | undefined;

    function* Child(_props: { $patch?: string }) {
      patchValue = yield* $patchContext();
      renderCount++;
      return createElement("span", { id: "child" }, patchValue);
    }

    function* Parent() {
      const [patch, sp] = yield* $state<"live" | "default">("default");
      setPatch = sp;
      return createElement(Child as never, { $patch: patch });
    }

    render(createElement(Parent as never, {}), container);
    expect(renderCount).toBe(1);
    expect(patchValue).toBe("default");

    // Change $patch — Child SHOULD rerender because it consumes $patchContext
    setPatch!("live");
    expect(renderCount).toBe(2);
    expect(patchValue).toBe("live");
    expect(container.querySelector("#child")!.textContent).toBe("live");
  });
});
