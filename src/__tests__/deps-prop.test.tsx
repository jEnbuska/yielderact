import { createContext, useContext } from "../context";
import { useState } from "../hooks";
import { createElement } from "../jsx";
import { render } from "../render";

describe("$deps prop", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("skips component rerender when $deps are unchanged", () => {
    let renderCount = 0;
    let setParentState: (v: number) => void = () => {};

    function* Child(_props: { data: Record<string, unknown> }) {
      renderCount++;
      return <p>{`renders: ${renderCount}`}</p>;
    }

    function* Parent() {
      const [count, setCount] = yield* useState(0);
      setParentState = setCount;
      const data = { value: count };
      // $deps only depends on count — if count stays the same,
      // child should not rerender even though data is a new object.
      return (
        <div>
          <Child data={data} $deps={[count]} />
        </div>
      );
    }

    render(<Parent />, container);
    expect(renderCount).toBe(1);

    // Trigger parent rerender with same count -> child should be skipped
    void setParentState(0);
    expect(renderCount).toBe(1);

    // Trigger parent rerender with different count -> child should rerender
    void setParentState(1);
    expect(renderCount).toBe(2);
  });

  it("rerenders component when $deps change", () => {
    let renderCount = 0;
    let setA: (v: number) => void = () => {};

    function* Child(_props: { a: number; b: number }) {
      renderCount++;
      return <span>{`a=${_props.a}`}</span>;
    }

    function* Parent() {
      const [a, setAFn] = yield* useState(1);
      setA = setAFn;
      return <Child a={a} b={99} $deps={[a]} />;
    }

    render(<Parent />, container);
    expect(renderCount).toBe(1);

    void setA(2);
    expect(renderCount).toBe(2);
    expect(container.textContent).toContain("a=2");
  });

  it("skips HTML element updateProps when $deps are unchanged", () => {
    let setParentState: (v: string) => void = () => {};

    function* Parent() {
      const [cls, setCls] = yield* useState("cls-a");
      setParentState = setCls;
      return <div className={cls} data-extra={Math.random().toString()} $deps={[cls]} />;
    }

    render(<Parent />, container);
    const el = container.querySelector("div") as HTMLElement;
    expect(el.className).toBe("cls-a");
    const extraBefore = el.getAttribute("data-extra");

    // Same cls -> $deps unchanged -> updateProps skipped -> data-extra unchanged
    void setParentState("cls-a");
    expect(el.getAttribute("data-extra")).toBe(extraBefore);

    // Different cls -> $deps changed -> updateProps runs
    void setParentState("cls-b");
    expect(el.className).toBe("cls-b");
    expect(el.getAttribute("data-extra")).not.toBe(extraBefore);
  });

  it("updates HTML element when $deps change", () => {
    let setVal: (v: string) => void = () => {};

    function* Parent() {
      const [val, setValFn] = yield* useState("hello");
      setVal = setValFn;
      return <div data-val={val} $deps={[val]} />;
    }

    render(<Parent />, container);
    expect((container.querySelector("div") as HTMLElement).getAttribute("data-val")).toBe("hello");

    void setVal("world");
    expect((container.querySelector("div") as HTMLElement).getAttribute("data-val")).toBe("world");
  });

  it("does not set $deps as a DOM attribute", () => {
    render(<div $deps={[1, 2, 3]} />, container);
    const el = container.querySelector("div") as HTMLElement;
    expect(el.hasAttribute("$deps")).toBe(false);
  });

  it("does not pass $deps to component props", () => {
    let receivedProps: Record<string, unknown> = {};

    function* Child(props: { name: string }) {
      receivedProps = props;
      return <p>{props.name}</p>;
    }

    render(<Child name="test" $deps={[1]} />, container);
    expect(receivedProps["name"]).toBe("test");
    expect("$deps" in receivedProps).toBe(false);
  });

  it("falls back to shallowEqual when $deps is removed", () => {
    let renderCount = 0;
    let setUseDeps: (v: boolean) => void = () => {};
    let setVal: (v: number) => void = () => {};

    function* Child(_props: { val: number }) {
      renderCount++;
      return <p>{`${renderCount}`}</p>;
    }

    function* Parent() {
      const [useDeps, setUseDepsF] = yield* useState(true);
      const [val, setValF] = yield* useState(0);
      setUseDeps = setUseDepsF;
      setVal = setValF;
      const props: Record<string, unknown> = { val };
      if (useDeps) props.$deps = [val];
      return createElement(Child as never, props);
    }

    render(<Parent />, container);
    expect(renderCount).toBe(1);

    // Remove $deps -> props differ (prevSlot had $deps, new doesn't) -> rerenders
    void setUseDeps(false);
    expect(renderCount).toBe(2);

    // Now using shallowEqual: same val -> skip
    void setVal(0);
    expect(renderCount).toBe(2);

    // Change val -> shallowEqual detects difference -> rerender
    void setVal(1);
    expect(renderCount).toBe(3);
  });

  it("still unmounts when $shown becomes false with $deps", () => {
    let setShown: (v: boolean) => void = () => {};

    function* Child() {
      return <p>child</p>;
    }

    function* Parent() {
      const [shown, setS] = yield* useState(true);
      setShown = setS;
      return <Child $shown={shown} $deps={[]} />;
    }

    render(<Parent />, container);
    expect(container.querySelector("p")).not.toBeNull();

    void setShown(false);
    expect(container.querySelector("p")).toBeNull();
  });

  it("context changes still trigger rerender even when $deps unchanged", () => {
    let renderCount = 0;
    let setTheme: (v: string) => void = () => {};

    const ThemeCtx = createContext("light");

    function* Consumer(_props: { extra: number }) {
      const theme = yield* useContext(ThemeCtx);
      renderCount++;
      return <span>{theme}</span>;
    }

    function* Provider() {
      const [theme, setT] = yield* useState("light");
      setTheme = setT;
      // $deps is stable (empty) but context should still trigger rerender
      return <Consumer extra={42} $deps={[]} $context={ThemeCtx(theme)} />;
    }

    render(<Provider />, container);
    expect(renderCount).toBe(1);
    expect(container.textContent).toContain("light");

    void setTheme("dark");
    expect(renderCount).toBe(2);
    expect(container.textContent).toContain("dark");
  });

  it("skips entire subtree of HTML element when $deps are unchanged", () => {
    let setChild: (v: string) => void = () => {};

    function* Parent() {
      const [child, setC] = yield* useState("hello");
      setChild = setC;
      return (
        <div className="wrapper" $deps={["stable"]}>
          {child}
        </div>
      );
    }

    render(<Parent />, container);
    expect(container.textContent).toContain("hello");

    void setChild("world");
    // Entire subtree should be frozen when $deps didn't change
    expect(container.textContent).toContain("hello");
  });
});
