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
});
