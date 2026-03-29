import { useState } from "../hooks";
import { render } from "../render";

describe("setState promise behavior", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("setState returns Promise<void> that resolves after the rerender commits", async () => {
    let setter: (v: number) => Promise<void> = () => Promise.resolve();
    let renderCount = 0;

    function* Comp() {
      const [n, setN] = yield* useState(0);
      setter = setN;
      renderCount++;
      return <span>{String(n)}</span>;
    }

    render(<Comp />, container);
    expect(renderCount).toBe(1);
    expect(container.querySelector("span")?.textContent).toBe("0");

    const p = setter(42);
    await p;
    expect(renderCount).toBe(2);
    expect(container.querySelector("span")?.textContent).toBe("42");
  });

  it("only the latest setState promise resolves when multiple are called", async () => {
    let setter: (v: number) => Promise<void> = () => Promise.resolve();
    const resolved: number[] = [];

    function* Comp() {
      const [n, setN] = yield* useState(0);
      setter = setN;
      return <span>{String(n)}</span>;
    }

    render(<Comp />, container);

    const p1 = setter(1);
    const p2 = setter(2);
    const p3 = setter(3);

    // Only p3 should resolve — p1 and p2 are abandoned
    void p1.then(() => resolved.push(1));
    void p2.then(() => resolved.push(2));
    void p3.then(() => resolved.push(3));

    await p3;
    expect(resolved).toEqual([3]);
    expect(container.querySelector("span")?.textContent).toBe("3");
  });

  it("setState with same value twice renders once and only the last promise resolves", async () => {
    let setter: (v: number) => Promise<void> = () => Promise.resolve();
    let renderCount = 0;
    const resolved: string[] = [];

    function* Comp() {
      const [n, setN] = yield* useState(0);
      setter = setN;
      renderCount++;
      return <span>{String(n)}</span>;
    }

    render(<Comp />, container);
    expect(renderCount).toBe(1);

    const p1 = setter(3);
    const p2 = setter(3);

    void p1.then(() => resolved.push("p1"));
    void p2.then(() => resolved.push("p2"));

    await p2;
    // Component should only render once (value didn't change between the two calls)
    expect(renderCount).toBe(2);
    expect(container.querySelector("span")?.textContent).toBe("3");
    // Only the last promise resolves
    expect(resolved).toEqual(["p2"]);
  });

  it("multiple setStates on different hooks batch into a single render", async () => {
    let setA: (v: number) => Promise<void> = () => Promise.resolve();
    let setB: (v: string) => Promise<void> = () => Promise.resolve();
    let setC: (v: boolean) => Promise<void> = () => Promise.resolve();
    let renderCount = 0;

    function* Comp() {
      const [a, sa] = yield* useState(0);
      const [b, sb] = yield* useState("x");
      const [c, sc] = yield* useState(false);
      setA = sa;
      setB = sb;
      setC = sc;
      renderCount++;
      return <span>{`${a}:${b}:${c}`}</span>;
    }

    render(<Comp />, container);
    expect(renderCount).toBe(1);

    void setA(1);
    void setB("y");
    await setC(true);

    // All three setStates should batch into a single rerender
    expect(renderCount).toBe(2);
    expect(container.querySelector("span")?.textContent).toBe("1:y:true");
  });

  it("child setState + parent setState: parent renders once, then child renders once", async () => {
    let setChildState: (v: number) => Promise<void> = () => Promise.resolve();
    let setParentState: (v: number) => Promise<void> = () => Promise.resolve();
    let parentRenderCount = 0;
    let childRenderCount = 0;

    function* Child({ label }: { label: string }) {
      const [n, setN] = yield* useState(0);
      setChildState = setN;
      childRenderCount++;
      return <span id="child">{`${label}:${n}`}</span>;
    }

    function* Parent() {
      const [p, setP] = yield* useState(0);
      setParentState = setP;
      parentRenderCount++;
      return (
        <div>
          <span id="parent">{String(p)}</span>
          <Child label={`p${p}`} />
        </div>
      );
    }

    render(<Parent />, container);
    expect(parentRenderCount).toBe(1);
    expect(childRenderCount).toBe(1);

    void setChildState(1);
    await setParentState(2);

    // Parent should render once (its own setState)
    expect(parentRenderCount).toBe(2);
    expect(container.querySelector("#parent")?.textContent).toBe("2");

    // Child renders once — parent is processed first (lower slotId),
    // so the child's rerender picks up both new props and new state.
    expect(childRenderCount).toBe(2);
    expect(container.querySelector("#child")?.textContent).toBe("p2:1");
  });

  it("renders in tree order regardless of setState call order", async () => {
    const setters: Record<string, (v: string) => Promise<void>> = {};
    const renderOrder: string[] = [];

    // $0.$1.$1
    function* LeafB1() {
      const [val, setVal] = yield* useState("init");
      setters["$0.$1.$1"] = setVal;
      renderOrder.push(`$0.$1.$1:${val}`);
      return <span>{val}</span>;
    }

    // $0.$1.$0
    function* LeafB0() {
      const [val, setVal] = yield* useState("init");
      setters["$0.$1.$0"] = setVal;
      renderOrder.push(`$0.$1.$0:${val}`);
      return <span>{val}</span>;
    }

    // $0.$1
    function* BranchB() {
      const [val, setVal] = yield* useState("init");
      setters["$0.$1"] = setVal;
      renderOrder.push(`$0.$1:${val}`);
      return (
        <div>
          <LeafB0 />
          <LeafB1 />
        </div>
      );
    }

    // $0.$0
    function* BranchA() {
      const [val, setVal] = yield* useState("init");
      setters["$0.$0"] = setVal;
      renderOrder.push(`$0.$0:${val}`);
      return <span>{val}</span>;
    }

    // $0
    function* Root() {
      const [val, setVal] = yield* useState("init");
      setters["$0"] = setVal;
      renderOrder.push(`$0:${val}`);
      return (
        <div>
          <BranchA />
          <BranchB />
        </div>
      );
    }

    render(<Root />, container);
    renderOrder.length = 0; // clear initial mount

    // Call setState in reverse tree order (deepest leaf first)
    void (setters["$0.$1.$1"] as (v: string) => Promise<void>)("updated");
    void (setters["$0.$1.$0"] as (v: string) => Promise<void>)("updated");
    void (setters["$0.$1"] as (v: string) => Promise<void>)("updated");
    void (setters["$0.$0"] as (v: string) => Promise<void>)("updated");
    await (setters["$0"] as (v: string) => Promise<void>)("updated");

    // All components should render in depth-first tree order
    expect(renderOrder).toEqual([
      "$0:updated",
      "$0.$0:updated",
      "$0.$1:updated",
      "$0.$1.$0:updated",
      "$0.$1.$1:updated",
    ]);
  });
});
