import { useMemo, useState } from "../hooks";
import { render } from "../render";
import { SetStateDuringRenderError } from "../render/errors";

describe("no setState during render", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("throws when a component calls its own setState during render", () => {
    function* Comp() {
      const [n, setN] = yield* useState(0);
      if (n === 0) void setN(1); // setState during render
      return <span>{String(n)}</span>;
    }

    expect(() => render(<Comp />, container)).toThrow(SetStateDuringRenderError);
  });

  it("throws when a component calls setState on another component during render via useMemo", () => {
    let setSibling: (v: number) => void = () => {};

    function* Sibling() {
      const [n, setN] = yield* useState(0);
      setSibling = setN;
      return <span id="sib">{String(n)}</span>;
    }

    function* Caller() {
      yield* useMemo(() => {
        setSibling(42); // setState on sibling during render
      }, []);
      return <span>caller</span>;
    }

    // Sibling renders first and captures setSibling
    // Then Caller renders and calls setSibling during its render
    expect(() => {
      render(
        <div>
          <Sibling />
          <Caller />
        </div>,
        container,
      );
    }).toThrow(SetStateDuringRenderError);
  });

  it("does not throw when setState is called from an event handler", async () => {
    let setter: (v: number) => void = () => {};

    function* Comp() {
      const [n, setN] = yield* useState(0);
      setter = setN;
      return <span>{String(n)}</span>;
    }

    render(<Comp />, container);
    expect(container.querySelector("span")?.textContent).toBe("0");

    // setState from outside render — should work fine
    await setter(5);
    expect(container.querySelector("span")?.textContent).toBe("5");
  });
});
