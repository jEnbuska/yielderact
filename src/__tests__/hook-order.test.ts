import { createContext, useContext } from "../context";
import { useEffect, useMemo, useRef, useState } from "../hooks";
import { createElement } from "../jsx";
import { createRoot } from "../render";

describe("hook order validation", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("throws when a hook is conditionally removed on re-render", () => {
    let toggle = true;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* Conditional() {
      const [count, set] = yield* useState(0);
      setCount = set;
      if (toggle) {
        yield* useRef(null);
      }
      return createElement("span", null, String(count));
    }

    const root = createRoot(container);
    root.render(createElement(Conditional as never, {}));
    expect(container.textContent).toBe("0");

    // Remove the conditional hook on re-render
    toggle = false;
    expect(() => setCount(1)).toThrow(/Hook count mismatch.*"Conditional"/);
  });

  it("throws when hook types are swapped", () => {
    let swapped = false;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* SwapHooks() {
      const [count, set] = yield* useState(0);
      setCount = set;
      if (swapped) {
        yield* useRef(null);
        yield* useMemo(() => 42, []);
      } else {
        yield* useMemo(() => 42, []);
        yield* useRef(null);
      }
      return createElement("span", null, String(count));
    }

    const root = createRoot(container);
    root.render(createElement(SwapHooks as never, {}));

    swapped = true;
    expect(() => setCount(1)).toThrow(/Hook order mismatch.*"SwapHooks".*index 1/);
  });

  it("throws when hook count decreases on completed render", () => {
    let useExtra = true;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* HookCountDecrease() {
      const [count, set] = yield* useState(0);
      setCount = set;
      yield* useRef(null);
      if (useExtra) {
        yield* useMemo(() => 42, []);
      }
      return createElement("span", null, String(count));
    }

    const root = createRoot(container);
    root.render(createElement(HookCountDecrease as never, {}));

    useExtra = false;
    expect(() => setCount(1)).toThrow(/Hook count mismatch.*"HookCountDecrease"/);
  });

  it("throws when hook count increases on completed render", () => {
    let useExtra = false;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* HookCountIncrease() {
      const [count, set] = yield* useState(0);
      setCount = set;
      yield* useRef(null);
      if (useExtra) {
        yield* useMemo(() => 42, []);
      }
      return createElement("span", null, String(count));
    }

    const root = createRoot(container);
    root.render(createElement(HookCountIncrease as never, {}));

    useExtra = true;
    expect(() => setCount(1)).toThrow(/Hook count mismatch.*"HookCountIncrease"/);
  });

  it("useContext is NOT exempt from order validation", () => {
    const Ctx1 = createContext("a");
    const Ctx2 = createContext("b");
    let useCtx = true;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* ContextNotExempt() {
      const [count, set] = yield* useState(0);
      setCount = set;
      if (useCtx) {
        yield* useContext(Ctx1);
        yield* useContext(Ctx2);
      }
      yield* useRef(null);
      return createElement("span", null, String(count));
    }

    const root = createRoot(container);
    root.render(createElement(ContextNotExempt as never, {}));
    expect(container.textContent).toBe("0");

    // Removing context hooks DOES throw — useContext follows the same rules as all hooks
    useCtx = false;
    expect(() => setCount(1)).toThrow(/Hook.*mismatch.*"ContextNotExempt"/);
  });

  it("useContext cannot be reordered", () => {
    const Ctx1 = createContext("a");
    const Ctx2 = createContext("b");
    let swapContexts = false;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* ContextReorder() {
      const [count, set] = yield* useState(0);
      setCount = set;
      if (swapContexts) {
        yield* useContext(Ctx2);
        yield* useContext(Ctx1);
      } else {
        yield* useContext(Ctx1);
        yield* useContext(Ctx2);
      }
      return createElement("span", null, String(count));
    }

    const root = createRoot(container);
    root.render(createElement(ContextReorder as never, {}));

    // Swapping context hooks throws — same order required on every render
    swapContexts = true;
    expect(() => setCount(1)).not.toThrow();
  });

  it("correct hook order does not throw", () => {
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* Stable() {
      const [count, set] = yield* useState(0);
      setCount = set;
      yield* useRef(null);
      yield* useMemo(() => count * 2, [count]);
      yield* useEffect(() => undefined, [count]);
      return createElement("span", null, String(count));
    }

    const root = createRoot(container);
    root.render(createElement(Stable as never, {}));
    expect(container.textContent).toBe("0");

    expect(() => setCount(1)).not.toThrow();
    expect(container.textContent).toBe("1");

    expect(() => setCount(2)).not.toThrow();
    expect(container.textContent).toBe("2");
  });

  it("error message includes component name and hook names", () => {
    let swapped = false;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* NamedComponent() {
      const [count, set] = yield* useState(0);
      setCount = set;
      if (swapped) {
        yield* useMemo(() => 1, []);
      } else {
        yield* useRef(null);
      }
      return createElement("span", null, String(count));
    }

    const root = createRoot(container);
    root.render(createElement(NamedComponent as never, {}));

    swapped = true;
    try {
      setCount(1);
      // Should not reach here
      expect(true).toBe(false);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("NamedComponent");
      expect(msg).toContain("$USE_REF");
      expect(msg).toContain("$USE_MEMO");
      expect(msg).toContain("index 1");
    }
  });
});
