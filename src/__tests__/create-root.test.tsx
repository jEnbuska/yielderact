import { useState } from "../hooks";
import { createRoot } from "../render";

// jsdom is provided by vitest (see vitest.config.ts)

describe("createRoot", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders a component into the container", () => {
    function* Greeting({ name }: { name: string }) {
      return <h1>Hello, {name}!</h1>;
    }
    const root = createRoot(container);
    root.render(<Greeting name="World" />);
    expect(container.querySelector("h1")?.textContent).toBe("Hello, World!");
  });

  it("renders a component into the container", () => {
    function* Counter() {
      const [count] = yield* useState(0);
      return <span>{String(count)}</span>;
    }
    const root = createRoot(container);
    root.render(<Counter />);
    expect(container.textContent).toBe("0");
  });

  // TODO: Restore when $patch is re-implemented (#163)
  // it('sets $patch context to "default" for the rendered tree', () => {
  //   let capturedBatch: string | undefined;
  //
  //   function* Comp() {
  //     capturedBatch = yield* useContext(BatchContext);
  //     return <div />;
  //   }
  //
  //   const root = createRoot(container);
  //   root.render(<Comp />);
  //   expect(capturedBatch).toBe("default");
  // });

  // TODO: Restore when $patch is re-implemented (#163)
  // it("context map does not leak between independent roots", () => {
  //   let capturedBatch1: string | undefined;
  //   let capturedBatch2: string | undefined;
  //
  //   function* Comp1() {
  //     capturedBatch1 = yield* useContext(BatchContext);
  //     return <div />;
  //   }
  //   function* Comp2() {
  //     capturedBatch2 = yield* useContext(BatchContext);
  //     return <div />;
  //   }
  //
  //   const container2 = document.createElement("div");
  //   document.body.appendChild(container2);
  //   const root1 = createRoot(container);
  //   const root2 = createRoot(container2);
  //   root1.render(<Comp1 />);
  //   root2.render(<Comp2 />);
  //   expect(capturedBatch1).toBe("default");
  //   expect(capturedBatch2).toBe("default");
  //   document.body.removeChild(container2);
  // });

  it("two independent createRoot calls do not share state", async () => {
    const container2 = document.createElement("div");
    document.body.appendChild(container2);

    let setCount1: (v: number | ((p: number) => number)) => void = () => {};
    let setCount2: (v: number | ((p: number) => number)) => void = () => {};

    function* Counter1() {
      const [count, set] = yield* useState(0);
      setCount1 = set;
      return <span id="c1">{String(count)}</span>;
    }

    function* Counter2() {
      const [count, set] = yield* useState(100);
      setCount2 = set;
      return <span id="c2">{String(count)}</span>;
    }

    const root1 = createRoot(container);
    const root2 = createRoot(container2);
    root1.render(<Counter1 />);
    root2.render(<Counter2 />);

    expect(container.querySelector("#c1")?.textContent).toBe("0");
    expect(container2.querySelector("#c2")?.textContent).toBe("100");

    // Update root 1 — root 2 must not be affected.
    await setCount1(5);
    expect(container.querySelector("#c1")?.textContent).toBe("5");
    expect(container2.querySelector("#c2")?.textContent).toBe("100");

    // Update root 2 — root 1 must not be affected.
    await setCount2(200);
    expect(container.querySelector("#c1")?.textContent).toBe("5");
    expect(container2.querySelector("#c2")?.textContent).toBe("200");

    document.body.removeChild(container2);
  });
});
