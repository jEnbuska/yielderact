import { createContext, useContext } from "../context";
import { useResolve, useState } from "../hooks";
import { createElement } from "../jsx";
import { render } from "../render";

// jsdom is provided by vitest (see vitest.config.ts)

describe("children-only reconciliation optimization", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("skips generator re-execution when only children change", () => {
    let wrapperRuns = 0;
    let setPhase: (v: number) => void = () => {};

    function* Wrapper({ children }: { children?: unknown }) {
      wrapperRuns++;
      return createElement("div", { "data-testid": "wrapper" }, children);
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return createElement(Wrapper as never, {}, createElement("span", null, `phase-${phase}`));
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);
    expect(container.querySelector('[data-testid="wrapper"]')?.textContent).toBe("phase-0");

    // Parent rerenders → Wrapper gets new children VNode, but same own props
    setPhase(1);
    // Wrapper generator should NOT re-execute
    expect(wrapperRuns).toBe(1);
    // But children should update in the DOM
    expect(container.querySelector('[data-testid="wrapper"]')?.textContent).toBe("phase-1");
  });

  it("rerenders when non-children props change", () => {
    let wrapperRuns = 0;
    let setLabel: (v: string) => void = () => {};

    function* Wrapper({ label, children }: { label: string; children?: unknown }) {
      wrapperRuns++;
      return createElement("div", { "data-testid": "wrapper" }, label, ": ", children);
    }

    function* Parent() {
      const [label, sl] = yield* useState("hello");
      setLabel = sl;
      return createElement(Wrapper as never, { label }, createElement("span", null, "child"));
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);

    setLabel("world");
    // Non-children prop changed → full rerender
    expect(wrapperRuns).toBe(2);
    expect(container.querySelector('[data-testid="wrapper"]')?.textContent).toBe("world: child");
  });

  it("handles children added (empty → non-empty)", () => {
    let wrapperRuns = 0;
    let setShowChild: (v: boolean) => void = () => {};

    function* Wrapper({ children }: { children?: unknown }) {
      wrapperRuns++;
      return createElement("div", { "data-testid": "wrapper" }, children);
    }

    function* Parent() {
      const [showChild, ss] = yield* useState(false);
      setShowChild = ss;
      if (!showChild) {
        return createElement(Wrapper as never, {});
      }
      return createElement(Wrapper as never, {}, createElement("span", null, "hello"));
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);
    expect(container.querySelector("span")).toBeNull();

    setShowChild(true);
    // Children changed from none to some — optimization handles this
    // (falls back to rerender since childrenPosition was undefined → null transition)
    expect(container.querySelector("span")?.textContent).toBe("hello");
  });

  it("handles children removed (non-empty → empty)", () => {
    let wrapperRuns = 0;
    let setShowChild: (v: boolean) => void = () => {};

    function* Wrapper({ children }: { children?: unknown }) {
      wrapperRuns++;
      return createElement("div", { "data-testid": "wrapper" }, children);
    }

    function* Parent() {
      const [showChild, ss] = yield* useState(true);
      setShowChild = ss;
      if (showChild) {
        return createElement(Wrapper as never, {}, createElement("span", null, "hello"));
      }
      return createElement(Wrapper as never, {});
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);
    expect(container.querySelector("span")?.textContent).toBe("hello");

    setShowChild(false);
    // Children removed — the optimization reconciles the output
    expect(container.querySelector("span")).toBeNull();
  });

  it("updates child component props through the optimization", () => {
    let childRuns = 0;
    let setCount: (v: number) => void = () => {};

    function* Child({ value }: { value: number }) {
      childRuns++;
      return createElement("span", { "data-testid": "child" }, `val-${value}`);
    }

    function* Wrapper({ children }: { children?: unknown }) {
      return createElement("div", null, children);
    }

    function* Parent() {
      const [count, sc] = yield* useState(0);
      setCount = sc;
      return createElement(Wrapper as never, {}, createElement(Child as never, { value: count }));
    }

    render(createElement(Parent as never, {}), container);
    expect(childRuns).toBe(1);
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe("val-0");

    setCount(5);
    // Child should rerender with new props through the optimization
    expect(childRuns).toBe(2);
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe("val-5");
  });

  it("falls back to full rerender when component filters children", () => {
    let wrapperRuns = 0;
    let setPhase: (v: number) => void = () => {};

    function* FilterWrapper({ children }: { children?: unknown[] }) {
      wrapperRuns++;
      // Filter: only keep first child (breaks contiguous match when count > 1)
      const filtered = (children ?? []).slice(0, 1);
      return createElement("div", { "data-testid": "wrapper" }, ...filtered);
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return createElement(
        FilterWrapper as never,
        {},
        createElement("span", null, `kept-${phase}`),
        createElement("b", null, `dropped-${phase}`),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);
    expect(container.querySelector("b")).toBeNull();

    setPhase(1);
    // FilterWrapper drops second child → no full contiguous match → full rerender
    expect(wrapperRuns).toBe(2);
    expect(container.querySelector("span")?.textContent).toBe("kept-1");
  });

  it("falls back when component ignores children", () => {
    let wrapperRuns = 0;
    let setPhase: (v: number) => void = () => {};

    function* IgnoresChildren(_props: { children?: unknown }) {
      wrapperRuns++;
      return createElement("div", { "data-testid": "wrapper" }, "static");
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return createElement(
        IgnoresChildren as never,
        {},
        createElement("span", null, `phase-${phase}`),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);
    expect(container.querySelector('[data-testid="wrapper"]')?.textContent).toBe("static");

    setPhase(1);
    // Children not used → no contiguous match → full rerender
    expect(wrapperRuns).toBe(2);
    expect(container.querySelector('[data-testid="wrapper"]')?.textContent).toBe("static");
  });

  it("$deps takes full control — children optimization skipped", () => {
    let wrapperRuns = 0;
    let setPhase: (v: number) => void = () => {};

    function* Wrapper({ children }: { children?: unknown }) {
      wrapperRuns++;
      return createElement("div", { "data-testid": "wrapper" }, children);
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      // $deps freezes the component — no rerender regardless of children
      return createElement(
        Wrapper as never,
        { $deps: [] },
        createElement("span", null, `phase-${phase}`),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);

    setPhase(1);
    // $deps=[] → frozen, no rerender, children not reconciled
    expect(wrapperRuns).toBe(1);
    expect(container.querySelector("span")?.textContent).toBe("phase-0");
  });

  it("context change still triggers rerender", () => {
    const Ctx = createContext("default");
    let wrapperRuns = 0;
    let setCtxVal: (v: string) => void = () => {};

    function* Wrapper({ children }: { children?: unknown }) {
      const ctx = yield* useContext(Ctx);
      wrapperRuns++;
      return createElement("div", { "data-testid": "wrapper" }, ctx, " ", children);
    }

    function* Parent() {
      const [val, sv] = yield* useState("v1");
      setCtxVal = sv;
      return createElement(
        Ctx.Provider as never,
        { value: val },
        createElement(Wrapper as never, {}, createElement("span", null, "child")),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);
    expect(container.querySelector('[data-testid="wrapper"]')?.textContent).toBe("v1 child");

    setCtxVal("v2");
    // Context changed → Wrapper must rerender
    expect(wrapperRuns).toBe(2);
    expect(container.querySelector('[data-testid="wrapper"]')?.textContent).toBe("v2 child");
  });

  it("preserves component state across children-only updates", () => {
    let setPhase: (v: number) => void = () => {};
    let setInner: (v: number) => void = () => {};

    function* Stateful() {
      const [inner, si] = yield* useState(0);
      setInner = si;
      return createElement("span", { "data-testid": "stateful" }, `inner-${inner}`);
    }

    function* Wrapper({ children }: { children?: unknown }) {
      return createElement("div", null, children);
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return createElement(
        Wrapper as never,
        {},
        createElement("p", null, `phase-${phase}`),
        createElement(Stateful as never, {}),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector('[data-testid="stateful"]')?.textContent).toBe("inner-0");

    // Build up state in the nested stateful component
    setInner(42);
    expect(container.querySelector('[data-testid="stateful"]')?.textContent).toBe("inner-42");

    // Trigger parent rerender with children-only change
    setPhase(1);
    // State should be preserved
    expect(container.querySelector('[data-testid="stateful"]')?.textContent).toBe("inner-42");
    expect(container.querySelector("p")?.textContent).toBe("phase-1");
  });

  it("works with multiple children", () => {
    let wrapperRuns = 0;
    let setPhase: (v: number) => void = () => {};

    function* Wrapper({ children }: { children?: unknown }) {
      wrapperRuns++;
      return createElement("div", { "data-testid": "wrapper" }, children);
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return createElement(
        Wrapper as never,
        {},
        createElement("span", null, `a-${phase}`),
        createElement("span", null, `b-${phase}`),
        createElement("span", null, `c-${phase}`),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);
    const spans = container.querySelectorAll("span");
    expect(spans).toHaveLength(3);

    setPhase(1);
    expect(wrapperRuns).toBe(1);
    const updatedSpans = container.querySelectorAll("span");
    expect(updatedSpans[0]?.textContent).toBe("a-1");
    expect(updatedSpans[1]?.textContent).toBe("b-1");
    expect(updatedSpans[2]?.textContent).toBe("c-1");
  });

  it("works with nested wrapper components (recursive optimization)", () => {
    let outerRuns = 0;
    let innerRuns = 0;
    let setPhase: (v: number) => void = () => {};

    function* Inner({ children }: { children?: unknown }) {
      innerRuns++;
      return createElement("div", { "data-testid": "inner" }, children);
    }

    function* Outer({ children }: { children?: unknown }) {
      outerRuns++;
      return createElement(Inner as never, {}, children);
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return createElement(Outer as never, {}, createElement("span", null, `phase-${phase}`));
    }

    render(createElement(Parent as never, {}), container);
    expect(outerRuns).toBe(1);
    expect(innerRuns).toBe(1);

    setPhase(1);
    // Outer skipped via children optimization; Inner also skipped since
    // Outer's output passes children through without transformation
    expect(outerRuns).toBe(1);
    expect(innerRuns).toBe(1);
    expect(container.querySelector("span")?.textContent).toBe("phase-1");
  });

  it("handles children with mixed VNodes and primitives", () => {
    let wrapperRuns = 0;
    let setPhase: (v: number) => void = () => {};

    function* Wrapper({ children }: { children?: unknown }) {
      wrapperRuns++;
      return createElement("div", { "data-testid": "wrapper" }, children);
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return createElement(
        Wrapper as never,
        {},
        "prefix: ",
        createElement("span", null, `phase-${phase}`),
        " suffix",
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);

    setPhase(1);
    // Mixed children with VNodes and primitives — VNode is tracked
    expect(wrapperRuns).toBe(1);
    expect(container.querySelector("span")?.textContent).toBe("phase-1");
  });

  it("does not disrupt paused generator (useResolve pending) when children change", async () => {
    let wrapperRuns = 0;
    let setPhase: (v: number) => void = () => {};
    let resolvePromise: (v: string) => void = () => {};

    function* Wrapper({ children }: { children?: unknown }) {
      wrapperRuns++;
      const data = yield* useResolve(
        {
          fn: () =>
            new Promise<string>((resolve) => {
              resolvePromise = resolve;
            }),
          loading: createElement("span", { "data-testid": "loading" }, "Loading..."),
        },
        [],
      );
      return createElement("div", { "data-testid": "wrapper" }, data, " ", children);
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return createElement(Wrapper as never, {}, createElement("span", null, `phase-${phase}`));
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);
    // Should show loading spinner (generator is paused)
    expect(container.querySelector('[data-testid="loading"]')?.textContent).toBe("Loading...");

    // Parent rerenders with new children while generator is paused
    setPhase(1);
    // Generator must NOT be restarted — run count stays at 1
    expect(wrapperRuns).toBe(1);
    // Loading spinner should still be visible
    expect(container.querySelector('[data-testid="loading"]')?.textContent).toBe("Loading...");

    // Resolve the promise — generator rerenders from the top with resolved data
    resolvePromise("fetched");
    await new Promise((r) => setTimeout(r, 0));
    // Generator rerenders (2nd run) with the resolved data
    expect(wrapperRuns).toBe(2);
    // New children should appear (props were updated during pause)
    expect(container.querySelector('[data-testid="wrapper"]')?.textContent).toBe("fetched phase-1");
  });

  it("does not rerender when component returns null and children change", () => {
    let wrapperRuns = 0;
    let setPhase: (v: number) => void = () => {};
    let setVisible: (v: boolean) => void = () => {};

    function* ConditionalWrapper({ visible, children }: { visible: boolean; children?: unknown }) {
      wrapperRuns++;
      if (!visible) return null;
      return createElement("div", { "data-testid": "wrapper" }, children);
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      const [visible, sv] = yield* useState(false);
      setVisible = sv;
      return createElement(
        ConditionalWrapper as never,
        { visible },
        createElement("span", null, `phase-${phase}`),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(wrapperRuns).toBe(1);
    // Component returned null — nothing visible
    expect(container.querySelector('[data-testid="wrapper"]')).toBeNull();

    // Change children while component renders null
    setPhase(1);
    // Should NOT rerender — would just return null again (wasted work)
    expect(wrapperRuns).toBe(1);

    // Now make it visible with a non-children prop change
    setVisible(true);
    // Full rerender since non-children prop changed
    expect(wrapperRuns).toBe(2);
    // Should render with the latest children
    expect(container.querySelector('[data-testid="wrapper"]')?.textContent).toBe("phase-1");
  });
});
