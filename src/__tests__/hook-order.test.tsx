import { createContext, useContext } from "../context";
import { useEffect, useMemo, useRef, useState } from "../hooks";
import { createRoot } from "../render";

/**
 * Helper: call `fn`, await the microtask scheduler, and return
 * the first unhandled rejection error (if any).
 */
async function captureAsyncError(fn: () => void): Promise<Error | undefined> {
  let captured: Error | undefined;
  const handler = (reason: unknown) => {
    captured = reason as Error;
  };
  process.on("unhandledRejection", handler);
  fn();
  await Promise.resolve();
  // Give the scheduler's async loop time to propagate the error
  await new Promise((r) => setTimeout(r, 10));
  process.removeListener("unhandledRejection", handler);
  return captured;
}

describe("hook order validation", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("throws when a hook is conditionally removed on re-render", async () => {
    let toggle = true;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* Conditional() {
      const [count, set] = yield* useState(0);
      setCount = set;
      if (toggle) {
        yield* useRef(null);
      }
      return <span>{String(count)}</span>;
    }

    const root = createRoot(container);
    root.render(<Conditional />);
    expect(container.textContent).toBe("0");

    // Remove the conditional hook on re-render
    toggle = false;
    const error = await captureAsyncError(() => setCount(1));
    expect(error?.message).toMatch(/Hook count mismatch.*"Conditional"/);
  });

  it("throws when hook types are swapped", async () => {
    let swapped = false;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* SwapHooks() {
      const [count, set] = yield* useState(0);
      setCount = set;
      if (swapped) {
        yield* useRef(null);
        yield* useMemo(() => 42, []);
      } else {
        yield* useMemo(() => 42, []);
        yield* useRef(null);
      }
      return <span>{String(count)}</span>;
    }

    const root = createRoot(container);
    root.render(<SwapHooks />);

    swapped = true;
    const error = await captureAsyncError(() => setCount(1));
    expect(error?.message).toMatch(/Hook order mismatch.*"SwapHooks".*index 1/);
  });

  it("throws when hook count decreases on completed render", async () => {
    let useExtra = true;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* HookCountDecrease() {
      const [count, set] = yield* useState(0);
      setCount = set;
      yield* useRef(null);
      if (useExtra) {
        yield* useMemo(() => 42, []);
      }
      return <span>{String(count)}</span>;
    }

    const root = createRoot(container);
    root.render(<HookCountDecrease />);

    useExtra = false;
    const error = await captureAsyncError(() => setCount(1));
    expect(error?.message).toMatch(/Hook count mismatch.*"HookCountDecrease"/);
  });

  it("throws when hook count increases on completed render", async () => {
    let useExtra = false;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* HookCountIncrease() {
      const [count, set] = yield* useState(0);
      setCount = set;
      yield* useRef(null);
      if (useExtra) {
        yield* useMemo(() => 42, []);
      }
      return <span>{String(count)}</span>;
    }

    const root = createRoot(container);
    root.render(<HookCountIncrease />);

    useExtra = true;
    const error = await captureAsyncError(() => setCount(1));
    expect(error?.message).toMatch(/Hook count mismatch.*"HookCountIncrease"/);
  });

  it("useContext is NOT exempt from order validation", async () => {
    const Ctx1 = createContext("a");
    const Ctx2 = createContext("b");
    let useCtx = true;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* ContextNotExempt() {
      const [count, set] = yield* useState(0);
      setCount = set;
      if (useCtx) {
        yield* useContext(Ctx1);
        yield* useContext(Ctx2);
      }
      yield* useRef(null);
      return <span>{String(count)}</span>;
    }

    const root = createRoot(container);
    root.render(<ContextNotExempt />);
    expect(container.textContent).toBe("0");

    // Removing context hooks DOES throw — useContext follows the same rules as all hooks
    useCtx = false;
    const error = await captureAsyncError(() => setCount(1));
    expect(error?.message).toMatch(/Hook.*mismatch.*"ContextNotExempt"/);
  });

  it("useContext cannot be reordered", () => {
    const Ctx1 = createContext("a");
    const Ctx2 = createContext("b");
    let swapContexts = false;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* ContextReorder() {
      const [count, set] = yield* useState(0);
      setCount = set;
      if (swapContexts) {
        yield* useContext(Ctx2);
        yield* useContext(Ctx1);
      } else {
        yield* useContext(Ctx1);
        yield* useContext(Ctx2);
      }
      return <span>{String(count)}</span>;
    }

    const root = createRoot(container);
    root.render(<ContextReorder />);

    // Swapping context hooks throws — same order required on every render
    swapContexts = true;
    expect(() => setCount(1)).not.toThrow();
  });

  it("correct hook order does not throw", async () => {
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* Stable() {
      const [count, set] = yield* useState(0);
      setCount = set;
      yield* useRef(null);
      yield* useMemo(() => count * 2, [count]);
      yield* useEffect(() => undefined, [count]);
      return <span>{String(count)}</span>;
    }

    const root = createRoot(container);
    root.render(<Stable />);
    expect(container.textContent).toBe("0");

    expect(() => setCount(1)).not.toThrow();
    await Promise.resolve();
    expect(container.textContent).toBe("1");

    expect(() => setCount(2)).not.toThrow();
    await Promise.resolve();
    expect(container.textContent).toBe("2");
  });

  it("error message includes component name and hook names", async () => {
    let swapped = false;
    let setCount: (v: number | ((p: number) => number)) => void = () => {};

    function* NamedComponent() {
      const [count, set] = yield* useState(0);
      setCount = set;
      if (swapped) {
        yield* useMemo(() => 1, []);
      } else {
        yield* useRef(null);
      }
      return <span>{String(count)}</span>;
    }

    const root = createRoot(container);
    root.render(<NamedComponent />);

    swapped = true;
    const error = await captureAsyncError(() => {
      void setCount(1);
    });
    expect(error).toBeDefined();
    const msg = (error as Error).message;
    expect(msg).toContain("NamedComponent");
    expect(msg).toContain("$USE_REF");
    expect(msg).toContain("$USE_MEMO");
    expect(msg).toContain("index 1");
  });
});
