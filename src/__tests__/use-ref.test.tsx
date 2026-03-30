import { useRef, useState } from "../hooks";
import { render } from "../render";

// jsdom is provided by vitest (see vitest.config.ts)

describe("ref", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("returns an object with the initial value in .current", () => {
    let capturedRef: { current: number } = { current: 0 };

    function* Comp() {
      const ref = yield* useRef(42);
      capturedRef = ref;
      return <div />;
    }

    render(<Comp />, container);
    expect(capturedRef.current).toBe(42);
  });

  it("persists the same object across re-renders", async () => {
    const refInstances: object[] = [];
    let setValue: (v: number) => void = () => {};

    function* Comp() {
      const [, sv] = yield* useState(0);
      setValue = sv;
      const ref = yield* useRef(0);
      refInstances.push(ref);
      return <div />;
    }

    render(<Comp />, container);
    await setValue(1);

    expect(refInstances).toHaveLength(2);
    expect(refInstances[0]).toBe(refInstances[1]);
  });

  it("mutations to .current do not trigger a re-render", () => {
    let renderCount = 0;
    let capturedRef: { current: number } = { current: 0 };

    function* Comp() {
      renderCount++;
      const ref = yield* useRef(0);
      capturedRef = ref;
      return <div />;
    }

    render(<Comp />, container);
    expect(renderCount).toBe(1);

    capturedRef.current = 99;
    expect(renderCount).toBe(1);
    expect(capturedRef.current).toBe(99);
  });
});
