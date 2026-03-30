import { useState } from "../hooks";
import { render } from "../render";

// jsdom is provided by vitest (see vitest.config.ts)

// ---------------------------------------------------------------------------
// Prop memoization (no re-render if props unchanged)
// ---------------------------------------------------------------------------

describe("prop memoization", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("does not re-mount a child component when the parent re-renders with unchanged child props", async () => {
    let mountCount = 0;
    let parentRerender: () => void = () => {};

    function* Child({ label }: { label: string }) {
      mountCount++;
      return <span>{label}</span>;
    }

    function* Parent(_: Record<string, unknown>, rerender: () => void) {
      parentRerender = rerender;
      return (
        <div>
          <Child label="hello" />
        </div>
      );
    }

    render(<Parent />, container);
    expect(mountCount).toBe(1);
    expect(container.querySelector("span")?.textContent).toBe("hello");

    // Trigger parent re-render with same child props
    parentRerender();
    await Promise.resolve();
    // Child was NOT remounted (same props)
    expect(mountCount).toBe(1);
  });

  it("remounts a child component when props change", async () => {
    let mountCount = 0;
    let setPhase: (v: number) => void = () => {};

    function* Child({ label }: { label: string }) {
      mountCount++;
      return <span>{label}</span>;
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return (
        <div>
          <Child label={phase === 0 ? "first" : "second"} />
        </div>
      );
    }

    render(<Parent />, container);
    expect(mountCount).toBe(1);
    expect(container.querySelector("span")?.textContent).toBe("first");

    await setPhase(1);
    expect(mountCount).toBe(2);
    expect(container.querySelector("span")?.textContent).toBe("second");
  });
});

// ---------------------------------------------------------------------------
// Component renders other components (lifecycle managed by parent)
// ---------------------------------------------------------------------------

describe("component renders component", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders a component child", () => {
    function* Greeting({ name }: { name: string }) {
      return <h1>Hello, {name}!</h1>;
    }

    function* App() {
      return (
        <div>
          <Greeting name="World" />
        </div>
      );
    }

    render(<App />, container);
    expect(container.querySelector("h1")?.textContent).toBe("Hello, World!");
  });

  it("renders a component child with yield*", () => {
    function* Label({ text }: { text: string }) {
      return <em>{text}</em>;
    }

    function* App() {
      return (
        <div>
          <Label text="from-child" />
        </div>
      );
    }

    render(<App />, container);
    expect(container.querySelector("em")?.textContent).toBe("from-child");
  });

  it("child component maintains its own state across parent re-renders", async () => {
    let incrementCounter: () => void = () => {};
    let parentRerender: () => void = () => {};

    function* Counter() {
      const [count, setCount] = yield* useState(0);
      incrementCounter = () => setCount(count + 1);
      return <span id="counter">{String(count)}</span>;
    }

    function* Wrapper(_: Record<string, unknown>, rerender: () => void) {
      parentRerender = rerender;
      return (
        <div>
          <Counter />
        </div>
      );
    }

    render(<Wrapper />, container);
    expect(container.querySelector("#counter")?.textContent).toBe("0");

    // Increment child
    incrementCounter();
    await Promise.resolve();
    expect(container.querySelector("#counter")?.textContent).toBe("1");

    // Parent re-renders with SAME Counter props → child is reused (not remounted)
    parentRerender();
    await Promise.resolve();
    // Counter state is preserved (still at 1)
    expect(container.querySelector("#counter")?.textContent).toBe("1");
  });

  it("parent switching child component type unmounts old and mounts new", async () => {
    let setPhase: (v: number) => void = () => {};

    function* CompA() {
      return <span id="a">A</span>;
    }
    function* CompB() {
      return <span id="b">B</span>;
    }

    function* Parent() {
      const [phase, sp] = yield* useState(0);
      setPhase = sp;
      return <div>{phase === 0 ? <CompA /> : <CompB />}</div>;
    }

    render(<Parent />, container);
    expect(container.querySelector("#a")).not.toBeNull();
    expect(container.querySelector("#b")).toBeNull();

    await setPhase(1);
    expect(container.querySelector("#a")).toBeNull();
    expect(container.querySelector("#b")).not.toBeNull();
  });

  it("reconciles HTML element children in place across re-renders", async () => {
    let setStep: (v: number) => void = () => {};

    function* App() {
      const [step, ss] = yield* useState(0);
      setStep = ss;
      return step === 0 ? <p className="first">hello</p> : <p className="second">world</p>;
    }

    render(<App />, container);
    const p = container.querySelector("p") as HTMLParagraphElement;
    expect(p.className).toBe("first");
    expect(p.textContent).toBe("hello");

    await setStep(1);
    // Same <p> element is reused (updated in place)
    expect(container.querySelector("p")).toBe(p);
    expect(p.className).toBe("second");
    expect(p.textContent).toBe("world");
  });

  it("renders Fragment with multiple component children", () => {
    function* A() {
      return <span id="a">A</span>;
    }
    function* B() {
      return <span id="b">B</span>;
    }

    function* App() {
      return (
        <>
          <A />
          <B />
        </>
      );
    }

    render(<App />, container);
    expect(container.querySelector("#a")?.textContent).toBe("A");
    expect(container.querySelector("#b")?.textContent).toBe("B");
  });
});
