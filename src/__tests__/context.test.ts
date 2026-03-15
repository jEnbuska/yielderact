import { createContext, useContext } from "../context";
import { useState } from "../hooks";
import { createElement } from "../jsx";
import { render } from "../render";

// useContext is now a generator – components must call it with yield*

// jsdom is provided by vitest (see vitest.config.ts)

describe("createContext / useContext", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("provides the default value when no Provider is present", () => {
    const Ctx = createContext("default");

    function* Consumer() {
      const value = yield* useContext(Ctx);
      return createElement("span", null, value);
    }

    render(createElement(Consumer as never, {}), container);
    expect(container.querySelector("span")?.textContent).toBe("default");
  });

  it("passes a value through Context.Provider to a consumer component", () => {
    const Ctx = createContext("default");

    function* Consumer() {
      const value = yield* useContext(Ctx);
      return createElement("span", null, value);
    }

    render(
      createElement(
        Ctx.Provider as never,
        { value: "provided" },
        createElement(Consumer as never, {}),
      ),
      container,
    );
    expect(container.querySelector("span")?.textContent).toBe("provided");
  });

  it("nested Providers shadow the outer value", () => {
    const Ctx = createContext("outer");

    function* Consumer() {
      const value = yield* useContext(Ctx);
      return createElement("span", null, value);
    }

    render(
      createElement(
        Ctx.Provider as never,
        { value: "outer" },
        createElement(
          "div",
          null,
          createElement(
            Ctx.Provider as never,
            { value: "inner" },
            createElement(Consumer as never, {}),
          ),
        ),
      ),
      container,
    );
    expect(container.querySelector("span")?.textContent).toBe("inner");
  });

  it("consumer outside Provider still gets default value", () => {
    const Ctx = createContext(42);

    function* Consumer() {
      const val = yield* useContext(Ctx);
      return createElement("span", null, String(val));
    }

    render(
      createElement(
        "div",
        null,
        createElement(
          Ctx.Provider as never,
          { value: 99 },
          createElement("span", { id: "inside" }, "ignored"),
        ),
        createElement(Consumer as never, {}),
      ),
      container,
    );
    const spans = container.querySelectorAll("span");
    const consumerSpan = Array.from(spans).find((s) => s.textContent === "42");
    expect(consumerSpan).toBeTruthy();
  });

  it("component reads context on every re-render", () => {
    const Ctx = createContext(0);
    let setTheme: (v: number) => void = () => {};

    function* Consumer() {
      const val = yield* useContext(Ctx);
      return createElement("span", null, String(val));
    }

    function* Parent() {
      const [theme, st] = yield* useState(7);
      setTheme = st;
      return createElement(
        Ctx.Provider as never,
        { value: theme },
        createElement(Consumer as never, {}),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector("span")?.textContent).toBe("7");

    setTheme(99);
    expect(container.querySelector("span")?.textContent).toBe("99");
  });

  // ── Scoping correctness tests (expose the "global ctxMap" bug) ──────────────

  it("context Provider value change preserves descendant component state", () => {
    // When the provider value changes the child component must NOT be remounted –
    // any local state it holds should survive the context update.
    const Ctx = createContext("initial");
    let setCtxValue: (v: string) => void = () => {};
    let setChildCount: (v: number) => void = () => {};

    function* Child() {
      const [count, setCount] = yield* useState(0);
      setChildCount = setCount;
      const ctxVal = yield* useContext(Ctx);
      return createElement("div", { "data-testid": "child" }, `${ctxVal}:${count}`);
    }

    function* Parent() {
      const [val, setVal] = yield* useState("A");
      setCtxValue = setVal;
      return createElement(
        Ctx.Provider as never,
        { value: val },
        createElement(Child as never, {}),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe("A:0");

    // Build up state in the child component
    setChildCount(5);
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe("A:5");

    // Change the context value – child state must NOT be reset
    setCtxValue("B");
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe("B:5");
  });

  it("context update propagates through non-consuming intermediate components", () => {
    // A component that does NOT consume the context must still pass context
    // changes through to a deeply nested consumer.
    const Ctx = createContext("default");
    let setCtxValue: (v: string) => void = () => {};

    function* Consumer() {
      const val = yield* useContext(Ctx);
      return createElement("span", { "data-testid": "consumer" }, val);
    }

    // Middle does NOT consume Ctx but is in the subtree
    function* Middle() {
      return createElement("div", null, createElement(Consumer as never, {}));
    }

    function* Root() {
      const [val, setVal] = yield* useState("first");
      setCtxValue = setVal;
      return createElement(
        Ctx.Provider as never,
        { value: val },
        createElement(Middle as never, {}),
      );
    }

    render(createElement(Root as never, {}), container);
    expect(container.querySelector('[data-testid="consumer"]')?.textContent).toBe("first");

    setCtxValue("second");
    expect(container.querySelector('[data-testid="consumer"]')?.textContent).toBe("second");
  });

  it("two sibling providers of the same context are isolated", () => {
    // Two independent Provider subtrees for the same context must not interfere
    // with each other when either re-renders.
    const Ctx = createContext("default");
    let setA: (v: string) => void = () => {};
    let setB: (v: string) => void = () => {};

    function* ConsumerA() {
      const val = yield* useContext(Ctx);
      return createElement("span", { "data-testid": "a" }, val);
    }

    function* ConsumerB() {
      const val = yield* useContext(Ctx);
      return createElement("span", { "data-testid": "b" }, val);
    }

    function* Root() {
      const [valA, sA] = yield* useState("A1");
      const [valB, sB] = yield* useState("B1");
      setA = sA;
      setB = sB;
      return createElement(
        "div",
        null,
        createElement(
          Ctx.Provider as never,
          { value: valA },
          createElement(ConsumerA as never, {}),
        ),
        createElement(
          Ctx.Provider as never,
          { value: valB },
          createElement(ConsumerB as never, {}),
        ),
      );
    }

    render(createElement(Root as never, {}), container);
    expect(container.querySelector('[data-testid="a"]')?.textContent).toBe("A1");
    expect(container.querySelector('[data-testid="b"]')?.textContent).toBe("B1");

    setA("A2");
    expect(container.querySelector('[data-testid="a"]')?.textContent).toBe("A2");
    expect(container.querySelector('[data-testid="b"]')?.textContent).toBe("B1");

    setB("B2");
    expect(container.querySelector('[data-testid="a"]')?.textContent).toBe("A2");
    expect(container.querySelector('[data-testid="b"]')?.textContent).toBe("B2");
  });

  it("inner Provider overrides outer Provider for the same context", () => {
    // A component that re-provides the same context must shadow the outer value
    // for all its descendants, even after the outer value changes.
    const Ctx = createContext("default");
    let setOuter: (v: string) => void = () => {};

    function* Consumer() {
      const val = yield* useContext(Ctx);
      return createElement("span", { "data-testid": "consumer" }, val);
    }

    // Middle re-provides a fixed inner value
    function* Middle() {
      return createElement(
        Ctx.Provider as never,
        { value: "inner" },
        createElement(Consumer as never, {}),
      );
    }

    function* Root() {
      const [outer, setOuter_] = yield* useState("outer-1");
      setOuter = setOuter_;
      return createElement(
        Ctx.Provider as never,
        { value: outer },
        createElement(Middle as never, {}),
      );
    }

    render(createElement(Root as never, {}), container);
    // Consumer is inside Middle's inner provider → sees "inner"
    expect(container.querySelector('[data-testid="consumer"]')?.textContent).toBe("inner");

    // Change outer value – Consumer must still see "inner" (not the outer value)
    setOuter("outer-2");
    expect(container.querySelector('[data-testid="consumer"]')?.textContent).toBe("inner");
  });

  it("parent reads outer context while child reads overridden inner context", () => {
    // A generator that both consumes an outer context value AND re-provides it
    // must receive the outer value itself while descendants receive the inner value.
    const Ctx = createContext("default");
    let setOuter: (v: string) => void = () => {};

    function* Child() {
      const val = yield* useContext(Ctx);
      return createElement("span", { "data-testid": "child" }, val);
    }

    function* Middle() {
      const outerVal = yield* useContext(Ctx);
      return createElement(
        "div",
        null,
        createElement("span", { "data-testid": "middle" }, outerVal),
        createElement(Ctx.Provider as never, { value: "inner" }, createElement(Child as never, {})),
      );
    }

    function* Root() {
      const [val, setVal] = yield* useState("outer");
      setOuter = setVal;
      return createElement(
        Ctx.Provider as never,
        { value: val },
        createElement(Middle as never, {}),
      );
    }

    render(createElement(Root as never, {}), container);
    expect(container.querySelector('[data-testid="middle"]')?.textContent).toBe("outer");
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe("inner");

    setOuter("outer-2");
    // Middle should see the new outer value
    expect(container.querySelector('[data-testid="middle"]')?.textContent).toBe("outer-2");
    // Child must still see "inner" (provided by Middle's inner Provider)
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe("inner");
  });

  it("non-consuming intermediate component state survives context update", () => {
    // A component that does NOT consume the context must keep its own state
    // when an ancestor provider value changes.
    const Ctx = createContext("initial");
    let setCtxValue: (v: string) => void = () => {};
    let setMiddleCount: (v: number) => void = () => {};

    function* Consumer() {
      const val = yield* useContext(Ctx);
      return createElement("span", { "data-testid": "consumer" }, val);
    }

    function* Middle() {
      const [count, setCount] = yield* useState(0);
      setMiddleCount = setCount;
      return createElement(
        "div",
        null,
        createElement("span", { "data-testid": "middle-count" }, String(count)),
        createElement(Consumer as never, {}),
      );
    }

    function* Root() {
      const [val, setVal] = yield* useState("v1");
      setCtxValue = setVal;
      return createElement(
        Ctx.Provider as never,
        { value: val },
        createElement(Middle as never, {}),
      );
    }

    render(createElement(Root as never, {}), container);
    expect(container.querySelector('[data-testid="consumer"]')?.textContent).toBe("v1");
    expect(container.querySelector('[data-testid="middle-count"]')?.textContent).toBe("0");

    // Build state in the intermediate (non-consuming) component
    setMiddleCount(7);
    expect(container.querySelector('[data-testid="middle-count"]')?.textContent).toBe("7");

    // Context changes – Middle's state (count=7) must be preserved
    setCtxValue("v2");
    expect(container.querySelector('[data-testid="consumer"]')?.textContent).toBe("v2");
    expect(container.querySelector('[data-testid="middle-count"]')?.textContent).toBe("7");
  });

  it("multiple different contexts are independently scoped", () => {
    // Two separate contexts must be completely independent – changing one must
    // not affect the other.
    const CtxA = createContext("a-default");
    const CtxB = createContext("b-default");
    let setA: (v: string) => void = () => {};
    let setB: (v: string) => void = () => {};

    function* Consumer() {
      const a = yield* useContext(CtxA);
      const b = yield* useContext(CtxB);
      return createElement("span", { "data-testid": "consumer" }, `${a}|${b}`);
    }

    function* Root() {
      const [valA, sA] = yield* useState("A1");
      const [valB, sB] = yield* useState("B1");
      setA = sA;
      setB = sB;
      return createElement(
        CtxA.Provider as never,
        { value: valA },
        createElement(
          CtxB.Provider as never,
          { value: valB },
          createElement(Consumer as never, {}),
        ),
      );
    }

    render(createElement(Root as never, {}), container);
    expect(container.querySelector('[data-testid="consumer"]')?.textContent).toBe("A1|B1");

    setA("A2");
    expect(container.querySelector('[data-testid="consumer"]')?.textContent).toBe("A2|B1");

    setB("B2");
    expect(container.querySelector('[data-testid="consumer"]')?.textContent).toBe("A2|B2");
  });

  describe("useContext with selector", () => {
    it("selector-only: returns full context value when selector present", () => {
      const Ctx = createContext({ a: 1, b: 2 });

      function* Consumer() {
        const val = yield* useContext(Ctx, (c) => [c.a]);
        return createElement("span", null, `${val.a}:${val.b}`);
      }

      render(
        createElement(
          Ctx.Provider as never,
          { value: { a: 1, b: 2 } },
          createElement(Consumer as never, {}),
        ),
        container,
      );
      expect(container.querySelector("span")?.textContent).toBe("1:2");
    });

    it("selector-only: suppresses rerender when selected deps are stable", () => {
      const Ctx = createContext({ a: 0, b: 0 });
      let setVal: (v: { a: number; b: number }) => void = () => {};
      let renderCount = 0;

      function* Consumer() {
        yield* useContext(Ctx, (c) => [c.a]);
        renderCount++;
        return createElement("span", null, String(renderCount));
      }

      function* Parent() {
        const [val, sv] = yield* useState({ a: 1, b: 1 });
        setVal = sv;
        return createElement(
          Ctx.Provider as never,
          { value: val },
          createElement(Consumer as never, {}),
        );
      }

      render(createElement(Parent as never, {}), container);
      expect(renderCount).toBe(1);

      // Change only `b` — selector selects `a`, so Consumer should NOT rerender.
      setVal({ a: 1, b: 99 });
      expect(renderCount).toBe(1);
      expect(container.querySelector("span")?.textContent).toBe("1");
    });

    it("selector-only: rerenders when selected dep changes", () => {
      const Ctx = createContext({ a: 0, b: 0 });
      let setVal: (v: { a: number; b: number }) => void = () => {};
      let renderCount = 0;

      function* Consumer() {
        const val = yield* useContext(Ctx, (c) => [c.a]);
        renderCount++;
        return createElement("span", null, String(val.a));
      }

      function* Parent() {
        const [val, sv] = yield* useState({ a: 1, b: 1 });
        setVal = sv;
        return createElement(
          Ctx.Provider as never,
          { value: val },
          createElement(Consumer as never, {}),
        );
      }

      render(createElement(Parent as never, {}), container);
      expect(renderCount).toBe(1);

      // Change `a` — selector selects `a`, so Consumer SHOULD rerender.
      setVal({ a: 99, b: 1 });
      expect(renderCount).toBe(2);
      expect(container.querySelector("span")?.textContent).toBe("99");
    });

    it("selector + transform: returns transformed value", () => {
      const Ctx = createContext({ name: "Alice", age: 30 });

      function* Consumer() {
        const name = yield* useContext(
          Ctx,
          (c) => [c.name] as [string],
          (n) => n.toUpperCase(),
        );
        return createElement("span", null, name);
      }

      render(
        createElement(
          Ctx.Provider as never,
          { value: { name: "Alice", age: 30 } },
          createElement(Consumer as never, {}),
        ),
        container,
      );
      expect(container.querySelector("span")?.textContent).toBe("ALICE");
    });

    it("selector + transform: suppresses rerender when deps stable", () => {
      const Ctx = createContext({ name: "Alice", count: 0 });
      let setVal: (v: { name: string; count: number }) => void = () => {};
      let renderCount = 0;

      function* Consumer() {
        yield* useContext(
          Ctx,
          (c) => [c.name] as [string],
          (n) => n.toUpperCase(),
        );
        renderCount++;
        return createElement("span", null, String(renderCount));
      }

      function* Parent() {
        const [val, sv] = yield* useState({ name: "Alice", count: 0 });
        setVal = sv;
        return createElement(
          Ctx.Provider as never,
          { value: val },
          createElement(Consumer as never, {}),
        );
      }

      render(createElement(Parent as never, {}), container);
      expect(renderCount).toBe(1);

      // Change only `count` — selector tracks `name`, so no rerender.
      setVal({ name: "Alice", count: 99 });
      expect(renderCount).toBe(1);
    });

    it("selector: hook state (useState) is preserved across suppressed rerenders", () => {
      const Ctx = createContext({ a: 0, b: 0 });
      let setVal: (v: { a: number; b: number }) => void = () => {};
      let setLocal: (v: number) => void = () => {};

      function* Consumer() {
        yield* useContext(Ctx, (c) => [c.a]);
        const [local, sl] = yield* useState(42);
        setLocal = sl;
        return createElement("span", null, String(local));
      }

      function* Parent() {
        const [val, sv] = yield* useState({ a: 1, b: 1 });
        setVal = sv;
        return createElement(
          Ctx.Provider as never,
          { value: val },
          createElement(Consumer as never, {}),
        );
      }

      render(createElement(Parent as never, {}), container);
      // Update local state in Consumer.
      setLocal(100);
      expect(container.querySelector("span")?.textContent).toBe("100");

      // Trigger a context change that should be suppressed (b changes, a stable).
      setVal({ a: 1, b: 99 });
      // Consumer should NOT have remounted — local state preserved.
      expect(container.querySelector("span")?.textContent).toBe("100");
    });

    it("no-selector consumer rerenders in-place when Provider value changes", () => {
      const Ctx = createContext({ a: 0, b: 0 });
      let setVal: (v: { a: number; b: number }) => void = () => {};
      let renderCount = 0;

      function* Consumer() {
        const val = yield* useContext(Ctx);
        renderCount++;
        return createElement("span", null, `${val.a}:${val.b}`);
      }

      function* Parent() {
        const [val, sv] = yield* useState({ a: 1, b: 1 });
        setVal = sv;
        return createElement(
          Ctx.Provider as never,
          { value: val },
          createElement(Consumer as never, {}),
        );
      }

      render(createElement(Parent as never, {}), container);
      expect(renderCount).toBe(1);

      // Change only `b` — Consumer has no selector so it always rerenders.
      setVal({ a: 1, b: 99 });
      expect(renderCount).toBe(2);
      expect(container.querySelector("span")?.textContent).toBe("1:99");
    });
  });
});
