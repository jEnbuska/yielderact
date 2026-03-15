import { useMemo, useResolve, useResolveRaw, useState } from "../hooks";
import type { Child } from "../jsx";
import { createElement } from "../jsx";
import { render } from "../render";

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

describe("render – generator components with useResolve", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("shows loading state while promise is pending", async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>((res) => {
      resolvePromise = res;
    });

    function* DataComp() {
      const data = yield* useResolve(
        {
          fn: (_signal) => promise,
          loading: createElement("span", { id: "loading" }, "Loading…"),
          error: createElement("span", { id: "error" }, "Error"),
        },
        [],
      );
      return createElement("span", { id: "data" }, data);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector("#loading")).not.toBeNull();
    expect(container.querySelector("#data")).toBeNull();

    resolvePromise("Hello World");
    await promise;

    expect(container.querySelector("#loading")).toBeNull();
    expect(container.querySelector("#data")).not.toBeNull();
    expect(container.querySelector("#data")?.textContent).toBe("Hello World");
  });

  it("shows error state when promise rejects", async () => {
    let rejectPromise!: (reason: unknown) => void;
    const promise = new Promise<string>((_res, rej) => {
      rejectPromise = rej;
    });

    function* DataComp() {
      const data = yield* useResolve(
        {
          fn: (_signal) => promise,
          loading: createElement("span", { id: "loading" }, "Loading…"),
          error: createElement("span", { id: "error" }, "Error"),
        },
        [],
      );
      return createElement("span", { id: "data" }, data);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector("#loading")).not.toBeNull();

    rejectPromise(new Error("network error"));
    await promise.catch(() => {}); // wait for rejection to propagate

    expect(container.querySelector("#error")).not.toBeNull();
    expect(container.querySelector("#data")).toBeNull();
  });

  it("useResolve can coexist with useState in the same component", async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>((res) => {
      resolvePromise = res;
    });
    let setLabel: (v: string) => void = () => {};

    function* DataComp() {
      const [label, sl] = yield* useState("prefix");
      setLabel = sl;
      const data = yield* useResolve(
        {
          fn: (_signal) => promise,
          loading: createElement("span", { id: "loading" }, "Loading…"),
          error: createElement("span", null, "Error"),
        },
        [],
      );
      return createElement("p", { id: "result" }, `${label}:${data}`);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector("#loading")).not.toBeNull();

    resolvePromise("world");
    await promise;

    expect(container.querySelector("#result")?.textContent).toBe("prefix:world");

    setLabel("updated");
    expect(container.querySelector("#result")?.textContent).toBe("updated:world");
  });

  it("useState change while promise is pending triggers fresh run and shows correct state after resolve", async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>((res) => {
      resolvePromise = res;
    });
    let setLabel: (v: string) => void = () => {};

    function* DataComp() {
      const [label, sl] = yield* useState("prefix");
      setLabel = sl;
      const data = yield* useResolve(
        {
          fn: (_signal) => promise,
          loading: createElement("span", { id: "loading" }, "Loading…"),
          error: createElement("span", null, "Error"),
        },
        [],
      );
      return createElement("p", { id: "result" }, `${label}:${data}`);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector("#loading")).not.toBeNull();

    // Change state WHILE the promise is still pending
    setLabel("updated");
    // Still loading, but label should be reflected after resolve
    expect(container.querySelector("#loading")).not.toBeNull();

    resolvePromise("world");
    await promise;

    // The fresh run after setLabel captured 'updated'; resume uses that generator
    expect(container.querySelector("#result")?.textContent).toBe("updated:world");
  });

  it("useResolve re-runs when deps change", async () => {
    let resolveFirst!: (data: string) => void;
    let resolveSecond!: (data: string) => void;
    const firstPromise = new Promise<string>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<string>((res) => {
      resolveSecond = res;
    });

    let setId: (v: number) => void = () => {};
    let fetchCount = 0;

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      const data = yield* useResolve(
        {
          fn: (_signal) => {
            fetchCount++;
            return id === 1 ? firstPromise : secondPromise;
          },
          loading: createElement("span", { id: "loading" }, "Loading…"),
          error: createElement("span", null, "Error"),
        },
        [id],
      );
      return createElement("p", { id: "result" }, `${id}:${data}`);
    }

    render(createElement(DataComp as never, {}), container);
    expect(fetchCount).toBe(1);
    expect(container.querySelector("#loading")).not.toBeNull();

    resolveFirst("user1");
    await firstPromise;
    expect(container.querySelector("#result")?.textContent).toBe("1:user1");

    // Change the dep – should re-run the promise
    setId(2);
    expect(fetchCount).toBe(2);
    expect(container.querySelector("#loading")).not.toBeNull();

    resolveSecond("user2");
    await secondPromise;
    expect(container.querySelector("#result")?.textContent).toBe("2:user2");
  });

  it("stale promise result is ignored when deps change before it resolves", async () => {
    let resolveFirst!: (data: string) => void;
    let resolveSecond!: (data: string) => void;
    const firstPromise = new Promise<string>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<string>((res) => {
      resolveSecond = res;
    });

    let setId: (v: number) => void = () => {};

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      const data = yield* useResolve(
        {
          fn: (_signal) => (id === 1 ? firstPromise : secondPromise),
          loading: createElement("span", { id: "loading" }, "Loading…"),
          error: createElement("span", null, "Error"),
        },
        [id],
      );
      return createElement("p", { id: "result" }, `${id}:${data}`);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector("#loading")).not.toBeNull();

    // Change dep before first promise resolves
    setId(2);
    expect(container.querySelector("#loading")).not.toBeNull();

    // Resolve second promise first
    resolveSecond("user2");
    await secondPromise;
    expect(container.querySelector("#result")?.textContent).toBe("2:user2");

    // Now resolve the stale first promise – should NOT update the DOM
    resolveFirst("user1");
    await firstPromise;
    expect(container.querySelector("#result")?.textContent).toBe("2:user2");
  });

  it("aborts the previous AbortSignal when deps change", async () => {
    const abortedSignals: AbortSignal[] = [];
    let setId: (v: number) => void = () => {};

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      yield* useResolve(
        {
          fn: (signal) => {
            signal.addEventListener("abort", () => abortedSignals.push(signal));
            return new Promise(() => {}); // never resolves
          },
          loading: createElement("span", { id: "loading" }, "Loading…"),
          error: createElement("span", null, "Error"),
        },
        [id],
      );
      return createElement("span", {}, "done");
    }

    render(createElement(DataComp as never, {}), container);
    expect(abortedSignals).toHaveLength(0);

    // Changing deps should abort the first signal and start a new fetch.
    setId(2);
    expect(abortedSignals).toHaveLength(1);
    expect(abortedSignals[0]?.aborted).toBe(true);
  });

  it("aborts the AbortSignal when the component unmounts", async () => {
    let capturedSignal: AbortSignal = new AbortController().signal;
    let setShow: (v: boolean) => void = () => {};

    function* Inner() {
      yield* useResolve(
        {
          fn: (signal) => {
            capturedSignal = signal;
            return new Promise(() => {}); // never resolves
          },
          loading: createElement("span", { id: "loading" }, "Loading…"),
          error: createElement("span", null, "Error"),
        },
        [],
      );
      return createElement("span", {}, "done");
    }

    function* Outer() {
      const [show, ss] = yield* useState(true);
      setShow = ss;
      return show ? createElement(Inner as never, {}) : null;
    }

    render(createElement(Outer as never, {}), container);
    expect(capturedSignal.aborted).toBe(false);

    // Unmount Inner by hiding it – the AbortSignal should be aborted.
    setShow(false);
    expect(capturedSignal.aborted).toBe(true);
  });
});

describe("render – generator components with useResolveRaw", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders loading state while promise is pending", async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>((res) => {
      resolvePromise = res;
    });

    function* DataComp() {
      const p = yield* useMemo(() => promise, []);
      const { data, loading } = yield* useResolveRaw<string>(p);
      if (loading) return createElement("span", { id: "loading" }, "Loading…");
      return createElement("span", { id: "data" }, data);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector("#loading")).not.toBeNull();
    expect(container.querySelector("#data")).toBeNull();

    resolvePromise("Hello");
    await promise;

    expect(container.querySelector("#loading")).toBeNull();
    expect(container.querySelector("#data")).not.toBeNull();
    expect(container.querySelector("#data")?.textContent).toBe("Hello");
  });

  it("renders error state when promise rejects", async () => {
    let rejectPromise!: (reason: unknown) => void;
    const promise = new Promise<string>((_res, rej) => {
      rejectPromise = rej;
    });

    function* DataComp() {
      const p = yield* useMemo(() => promise, []);
      const { data, loading, error } = yield* useResolveRaw<string, Error>(p);
      if (loading) return createElement("span", { id: "loading" }, "Loading…");
      if (error) return createElement("span", { id: "error" }, error.message);
      return createElement("span", { id: "data" }, data);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector("#loading")).not.toBeNull();

    rejectPromise(new Error("network error"));
    await promise.catch(() => {});

    expect(container.querySelector("#error")).not.toBeNull();
    expect(container.querySelector("#error")?.textContent).toBe("network error");
    expect(container.querySelector("#data")).toBeNull();
  });

  it("re-fetches when the promise reference changes", async () => {
    let resolveFirst!: (data: string) => void;
    let resolveSecond!: (data: string) => void;
    const firstPromise = new Promise<string>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<string>((res) => {
      resolveSecond = res;
    });
    let setId: (v: number) => void = () => {};

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      const p = yield* useMemo(() => (id === 1 ? firstPromise : secondPromise), [id]);
      const { data, loading } = yield* useResolveRaw<string>(p);
      if (loading) return createElement("span", { id: "loading" }, "Loading…");
      return createElement("p", { id: "result" }, `${id}:${data}`);
    }

    render(createElement(DataComp as never, {}), container);
    expect(container.querySelector("#loading")).not.toBeNull();

    resolveFirst("user1");
    await firstPromise;
    expect(container.querySelector("#result")?.textContent).toBe("1:user1");

    setId(2);
    expect(container.querySelector("#loading")).not.toBeNull();

    resolveSecond("user2");
    await secondPromise;
    expect(container.querySelector("#result")?.textContent).toBe("2:user2");
  });

  it("ignores stale promise result when promise reference changes", async () => {
    let resolveFirst!: (data: string) => void;
    let resolveSecond!: (data: string) => void;
    const firstPromise = new Promise<string>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<string>((res) => {
      resolveSecond = res;
    });
    let setId: (v: number) => void = () => {};

    function* DataComp() {
      const [id, si] = yield* useState(1);
      setId = si;
      const p = yield* useMemo(() => (id === 1 ? firstPromise : secondPromise), [id]);
      const { data, loading } = yield* useResolveRaw<string>(p);
      if (loading) return createElement("span", { id: "loading" }, "Loading…");
      return createElement("p", { id: "result" }, `${id}:${data}`);
    }

    render(createElement(DataComp as never, {}), container);

    setId(2);

    resolveSecond("user2");
    await secondPromise;
    expect(container.querySelector("#result")?.textContent).toBe("2:user2");

    resolveFirst("user1");
    await firstPromise;
    // Stale result must not overwrite the current render
    expect(container.querySelector("#result")?.textContent).toBe("2:user2");
  });
});

describe("useResolve / useResolveRaw – unmount during pending (zombie rerender)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("does not crash when component with useResolve is unmounted while loading", async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>((res) => {
      resolvePromise = res;
    });
    let setShow: (v: boolean) => void = () => {};

    function* Inner() {
      const data = yield* useResolve(
        {
          fn: (_signal) => promise,
          // Use <div> for loading — different tag from the resolved <span>,
          // so the zombie rerender forces a type-mismatch replace path that
          // crashes when endMarker.parentNode is null.
          loading: createElement("div", { id: "loading" }, "Loading…"),
          error: createElement("div", { id: "error" }, "Error"),
        },
        [],
      );
      return createElement("span", { id: "data" }, data);
    }

    function* Outer() {
      const [show, ss] = yield* useState(true);
      setShow = ss;
      return show
        ? (createElement(Inner as never, {}) as Child)
        : createElement("span", { id: "empty" }, "gone");
    }

    render(createElement(Outer as never, {}), container);
    expect(container.querySelector("#loading")).not.toBeNull();

    // Unmount Inner while the promise is still pending
    setShow(false);
    expect(container.querySelector("#empty")).not.toBeNull();

    // Resolve the promise AFTER unmount — must not crash
    resolvePromise("Hello");
    await promise;

    // UI should still show "gone", not crash or freeze
    expect(container.querySelector("#empty")?.textContent).toBe("gone");
  });

  it("does not crash when useResolveRaw promise rejects after unmount", async () => {
    let rejectPromise!: (reason: unknown) => void;
    const promise = new Promise<string>((_res, rej) => {
      rejectPromise = rej;
    });
    let setShow: (v: boolean) => void = () => {};

    function* Inner() {
      const p = yield* useMemo(() => promise, []);
      const { data, loading, error } = yield* useResolveRaw<string, Error>(p);
      // Use <div> for loading/error, <span> for data — different tags
      // trigger the type-mismatch replace path in the zombie rerender.
      if (loading) return createElement("div", { id: "loading" }, "Loading…");
      if (error) return createElement("div", { id: "error" }, error.message);
      return createElement("span", { id: "data" }, data);
    }

    function* Outer() {
      const [show, ss] = yield* useState(true);
      setShow = ss;
      return show
        ? (createElement(Inner as never, {}) as Child)
        : createElement("span", { id: "empty" }, "gone");
    }

    render(createElement(Outer as never, {}), container);
    expect(container.querySelector("#loading")).not.toBeNull();

    // Unmount Inner
    setShow(false);
    expect(container.querySelector("#empty")).not.toBeNull();

    // Reject the promise AFTER unmount — must not crash
    rejectPromise(new Error("network error"));
    await promise.catch(() => {});

    expect(container.querySelector("#empty")?.textContent).toBe("gone");
  });

  it("does not crash when component with useResolveRaw is unmounted while loading", async () => {
    let resolvePromise!: (data: string) => void;
    const promise = new Promise<string>((res) => {
      resolvePromise = res;
    });
    let setShow: (v: boolean) => void = () => {};

    function* Inner() {
      const p = yield* useMemo(() => promise, []);
      const { data, loading } = yield* useResolveRaw<string>(p);
      // Use <div> for loading, <span> for data — different tags
      // trigger the type-mismatch replace path in the zombie rerender.
      if (loading) return createElement("div", { id: "loading" }, "Loading…");
      return createElement("span", { id: "data" }, data);
    }

    function* Outer() {
      const [show, ss] = yield* useState(true);
      setShow = ss;
      return show
        ? (createElement(Inner as never, {}) as Child)
        : createElement("span", { id: "empty" }, "gone");
    }

    render(createElement(Outer as never, {}), container);
    expect(container.querySelector("#loading")).not.toBeNull();

    // Unmount Inner
    setShow(false);
    expect(container.querySelector("#empty")).not.toBeNull();

    // Resolve the promise AFTER unmount — must not crash
    resolvePromise("Hello");
    await promise;

    expect(container.querySelector("#empty")?.textContent).toBe("gone");
  });
});
