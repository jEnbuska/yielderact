import { useId, useState } from "../hooks";
import { render } from "../render";

// jsdom is provided by vitest (see vitest.config.ts)

describe("useId", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("returns a non-empty string", () => {
    let capturedId = "";

    function* Comp() {
      capturedId = yield* useId();
      return <div />;
    }

    render(<Comp />, container);
    expect(typeof capturedId).toBe("string");
    expect(capturedId.length).toBeGreaterThan(0);
  });

  it("returns the same id across re-renders", async () => {
    const ids: string[] = [];
    let setValue: (v: number) => void = () => {};

    function* Comp() {
      const [, sv] = yield* useState(0);
      setValue = sv;
      const id = yield* useId();
      ids.push(id);
      return <div />;
    }

    render(<Comp />, container);
    await setValue(1);

    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("returns distinct ids for different hook call sites", () => {
    let id1 = "";
    let id2 = "";

    function* Comp() {
      id1 = yield* useId();
      id2 = yield* useId();
      return <div />;
    }

    render(<Comp />, container);
    expect(id1).not.toBe(id2);
  });
});
