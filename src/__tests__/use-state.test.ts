import { useState } from "../hooks";
import { createElement } from "../jsx";
import { render } from "../render";

// jsdom is provided by vitest (see vitest.config.ts)

describe("useState", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("accepts a lazy initializer function called only once", () => {
    const init = vi.fn(() => 42);
    let capturedValue: number | null = null;
    let setValue: (v: number) => void = () => {};

    function* Comp() {
      const [v, sv] = yield* useState(init);
      capturedValue = v;
      setValue = sv;
      return createElement("div", null);
    }

    render(createElement(Comp as never, {}), container);
    expect(init).toHaveBeenCalledTimes(1);
    expect(capturedValue).toBe(42);

    // Re-render should not call the initializer again
    setValue(99);
    expect(init).toHaveBeenCalledTimes(1);
    expect(capturedValue).toBe(99);
  });

  it("accepts a functional updater that receives the previous state", () => {
    const values: number[] = [];
    let setValue: (v: number | ((prev: number) => number)) => void = () => {};

    function* Comp() {
      const [v, sv] = yield* useState(0);
      values.push(v);
      setValue = sv;
      return createElement("div", null);
    }

    render(createElement(Comp as never, {}), container);
    expect(values).toEqual([0]);

    setValue((prev) => prev + 5);
    expect(values).toEqual([0, 5]);

    setValue((prev) => prev * 2);
    expect(values).toEqual([0, 5, 10]);
  });
});
