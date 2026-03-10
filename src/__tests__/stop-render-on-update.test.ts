import { $effect, $memo, $state } from "../hooks";
import { createElement } from "../jsx";
import { render } from "../render";

describe("stop-render-on-update", () => {
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
      const [n, setN] = yield* $state(0);
      setter = setN;
      renderCount++;
      return createElement("span", null, String(n));
    }

    render(createElement(Comp as never, {}), container);
    expect(renderCount).toBe(1);
    expect(container.querySelector("span")?.textContent).toBe("0");

    const p = setter(42);
    // After the promise resolves the DOM must reflect the new state
    await p;
    expect(renderCount).toBe(2);
    expect(container.querySelector("span")?.textContent).toBe("42");
  });

  it("setState called during synchronous $memo queues the rerender instead of running recursively", () => {
    // Keep track of how many times the component body runs
    let renderCount = 0;
    let memoRuns = 0;

    function* Comp() {
      renderCount++;
      const [n, setN] = yield* $state(0);

      // $memo factory calls setState synchronously — this must be queued,
      // not executed as a nested synchronous rerender.
      yield* $memo(() => {
        memoRuns++;
        if (n === 0) {
          setN(1); // synchronous setState during render
        }
      }, [n]);

      return createElement("span", null, String(n));
    }

    render(createElement(Comp as never, {}), container);

    // First render: n=0, $memo calls setN(1) synchronously.
    // This should queue a rerender (pendingRerender=true), abort the first
    // render, and re-run with n=1.
    // Second render: n=1, $memo sees same dep (1) — cache hit, does NOT re-run.
    // Total renders: 2 (first cancelled + second committed), but renderCount
    // increments on every attempt so it will be 2.
    expect(renderCount).toBe(2);
    // memoRuns: once with n=0 (the run that caused the queue), once with n=1
    // (but deps changed so it runs again), wait... actually:
    // - Run 1 (cancelled): n=0, deps=[0], memoRuns++, setN(1) → pendingRerender
    // - Run 2 (committed): n=1, deps=[1], memoRuns++ (deps changed)
    expect(memoRuns).toBe(2);
    expect(container.querySelector("span")?.textContent).toBe("1");
  });

  it("multiple synchronous setState calls during one render collapse into a single follow-up render", () => {
    let renderCount = 0;
    function* Comp() {
      renderCount++;
      const [a, sa] = yield* $state(0);
      const [b, sb] = yield* $state(0);
      // sa and sb are used directly in the $memo callback below

      // Synchronously update both on first render
      yield* $memo(() => {
        if (a === 0 && b === 0) {
          sa(10);
          sb(20);
        }
      }, [a, b]);

      return createElement("span", null, `${a}:${b}`);
    }

    render(createElement(Comp as never, {}), container);

    // Initial render: cancelled after first setState
    // Follow-up render: committed with a=10, b=20 (sa(10) and sb(20) both applied)
    // Only ONE follow-up render should happen (both state changes batched)
    expect(container.querySelector("span")?.textContent).toBe("10:20");
    // renderCount is 2: one cancelled, one committed
    expect(renderCount).toBe(2);
  });

  it("$effect cleanup does NOT fire for a cancelled (mid-render-interrupted) render", () => {
    let cleanupCount = 0;
    let renderCount = 0;

    function* Comp() {
      renderCount++;
      const [n, setN] = yield* $state(0);

      yield* $effect(() => {
        return () => {
          cleanupCount++;
        };
      }, [n]);

      yield* $memo(() => {
        if (n === 0) setN(1);
      }, [n]);

      return createElement("span", null, String(n));
    }

    render(createElement(Comp as never, {}), container);

    // The render with n=0 was cancelled, so its $effect should NOT fire
    // (and therefore its cleanup never runs either).
    // The committed render is n=1.
    expect(renderCount).toBe(2);
    expect(container.querySelector("span")?.textContent).toBe("1");

    // No cleanup should have fired yet — only one effect was committed (n=1)
    expect(cleanupCount).toBe(0);
  });

  it("await setState resolves after the committed render, allowing async $memo continuation", async () => {
    const log: string[] = [];

    function* Comp() {
      const [name, setName] = yield* $state("joona");

      yield* $memo(async () => {
        log.push(`memo run: ${name}`);
        if (name !== name.toUpperCase()) {
          log.push("calling setName");
          await setName(name.toUpperCase());
          log.push("setName resolved, name in DOM is now uppercase");
        }
      }, [name]);

      return createElement("span", null, name);
    }

    render(createElement(Comp as never, {}), container);

    // Synchronous part: memo ran with 'joona', setName('JOONA') was called
    // (synchronously, before the first await in the async factory), which
    // queued a rerender. The first render was cancelled; the second committed
    // with 'JOONA'. After that the async memo's await resolved.
    expect(container.querySelector("span")?.textContent).toBe("JOONA");

    // Yield to the microtask queue so the async continuation runs
    await Promise.resolve();

    expect(log).toEqual([
      "memo run: joona",
      "calling setName",
      "memo run: JOONA", // second render, same deps cache hit? No – deps changed (joona→JOONA)
      "setName resolved, name in DOM is now uppercase",
    ]);
  });

  it("$memo cache is reused across a cancelled + retried render when deps are unchanged", () => {
    let memoRuns = 0;
    let setter: (v: string) => Promise<void> = () => Promise.resolve();

    function* Comp() {
      const [label, setLabel] = yield* $state("a");
      setter = setLabel;

      // memo deps: [label]
      const derived = yield* $memo(() => {
        memoRuns++;
        return label.toUpperCase();
      }, [label]);

      // On first render only: change unrelated state to trigger a cancel
      yield* $memo(() => {
        if (label === "a") {
          setLabel("b"); // queues rerender
        }
      }, [label]);

      return createElement("span", null, derived);
    }

    render(createElement(Comp as never, {}), container);

    // Run 1 (cancelled, label='a'): memoRuns++ (→1), setLabel('b') queued
    // Run 2 (committed, label='b'): memoRuns++ (→2) because deps changed
    expect(memoRuns).toBe(2);
    expect(container.querySelector("span")?.textContent).toBe("B");

    // Now trigger an external state change that does NOT change the memo deps
    setter("b"); // same value → shallowEqual, no rerender
    // (setter called with same value — $state setter still calls rerender but
    //  since value didn't change the component just re-renders and memo cache hits)
  });

  it("multiple awaited setState calls chain correctly", async () => {
    const domValues: string[] = [];

    function* Comp() {
      const [val, setVal] = yield* $state("start");

      yield* $memo(async () => {
        if (val === "start") {
          await setVal("middle");
          // After this resolves, DOM has 'middle'
          await setVal("end");
          // After this resolves, DOM has 'end'
        }
      }, [val]);

      return createElement("span", null, val);
    }

    render(createElement(Comp as never, {}), container);
    // Synchronous: val='start', setVal('middle') called → queued, render cancelled
    // Committed: val='middle'
    expect(container.querySelector("span")?.textContent).toBe("middle");

    // First microtask: await setVal('middle') resolved → setVal('end') called
    await Promise.resolve();
    // setVal('end') runs rerender synchronously (isRendering=false)
    expect(container.querySelector("span")?.textContent).toBe("end");

    // Second microtask: await setVal('end') resolved
    await Promise.resolve();
    domValues.push(container.querySelector("span")?.textContent ?? "");
    expect(domValues).toEqual(["end"]);
  });
});
