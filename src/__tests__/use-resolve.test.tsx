import { useMemo, useResolve, useResolveRaw, useState } from "../hooks";
import type { Child } from "../jsx";
import { render } from "../render";

// jsdom is provided by vitest (see vitest.config.ts)

describe("render – components with useResolve", () => {
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
          loading: <span id="loading">Loading&hellip;</span>,
          error: <span id="error">Error</span>,
        },
        [],
      );
      return <span id="data">{data}</span>;
    }

    render(<DataComp />, container);
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
          loading: <span id="loading">Loading&hellip;</span>,
          error: <span id="error">Error</span>,
        },
        [],
      );
      return <span id="data">{data}</span>;
    }

    render(<DataComp />, container);
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
          loading: <span id="loading">Loading&hellip;</span>,
          error: <span>Error</span>,
        },
        [],
      );
      return <p id="result">{`${label}:${data}`}</p>;
    }

    render(<DataComp />, container);
    expect(container.querySelector("#loading")).not.toBeNull();

    resolvePromise("world");
    await promise;

    expect(container.querySelector("#result")?.textContent).toBe("prefix:world");

    void setLabel("updated");
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
          loading: <span id="loading">Loading&hellip;</span>,
          error: <span>Error</span>,
        },
        [],
      );
      return <p id="result">{`${label}:${data}`}</p>;
    }

    render(<DataComp />, container);
    expect(container.querySelector("#loading")).not.toBeNull();

    // Change state WHILE the promise is still pending
    void setLabel("updated");
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
          loading: <span id="loading">Loading&hellip;</span>,
          error: <span>Error</span>,
        },
        [id],
      );
      return <p id="result">{`${id}:${data}`}</p>;
    }

    render(<DataComp />, container);
    expect(fetchCount).toBe(1);
    expect(container.querySelector("#loading")).not.toBeNull();

    resolveFirst("user1");
    await firstPromise;
    expect(container.querySelector("#result")?.textContent).toBe("1:user1");

    // Change the dep – should re-run the promise
    void setId(2);
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
          loading: <span id="loading">Loading&hellip;</span>,
          error: <span>Error</span>,
        },
        [id],
      );
      return <p id="result">{`${id}:${data}`}</p>;
    }

    render(<DataComp />, container);
    expect(container.querySelector("#loading")).not.toBeNull();

    // Change dep before first promise resolves
    void setId(2);
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
          loading: <span id="loading">Loading&hellip;</span>,
          error: <span>Error</span>,
        },
        [id],
      );
      return <span>done</span>;
    }

    render(<DataComp />, container);
    expect(abortedSignals).toHaveLength(0);

    // Changing deps should abort the first signal and start a new fetch.
    void setId(2);
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
          loading: <span id="loading">Loading&hellip;</span>,
          error: <span>Error</span>,
        },
        [],
      );
      return <span>done</span>;
    }

    function* Outer() {
      const [show, ss] = yield* useState(true);
      setShow = ss;
      return show ? <Inner /> : null;
    }

    render(<Outer />, container);
    expect(capturedSignal.aborted).toBe(false);

    // Unmount Inner by hiding it – the AbortSignal should be aborted.
    void setShow(false);
    expect(capturedSignal.aborted).toBe(true);
  });
});

describe("render – components with useResolveRaw", () => {
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
      if (loading) return <span id="loading">Loading&hellip;</span>;
      return <span id="data">{data}</span>;
    }

    render(<DataComp />, container);
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
      if (loading) return <span id="loading">Loading&hellip;</span>;
      if (error) return <span id="error">{error.message}</span>;
      return <span id="data">{data}</span>;
    }

    render(<DataComp />, container);
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
      if (loading) return <span id="loading">Loading&hellip;</span>;
      return <p id="result">{`${id}:${data}`}</p>;
    }

    render(<DataComp />, container);
    expect(container.querySelector("#loading")).not.toBeNull();

    resolveFirst("user1");
    await firstPromise;
    expect(container.querySelector("#result")?.textContent).toBe("1:user1");

    void setId(2);
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
      if (loading) return <span id="loading">Loading&hellip;</span>;
      return <p id="result">{`${id}:${data}`}</p>;
    }

    render(<DataComp />, container);

    void setId(2);

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
          loading: <div id="loading">Loading&hellip;</div>,
          error: <div id="error">Error</div>,
        },
        [],
      );
      return <span id="data">{data}</span>;
    }

    function* Outer() {
      const [show, ss] = yield* useState(true);
      setShow = ss;
      return show ? ((<Inner />) as Child) : <span id="empty">gone</span>;
    }

    render(<Outer />, container);
    expect(container.querySelector("#loading")).not.toBeNull();

    // Unmount Inner while the promise is still pending
    void setShow(false);
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
      if (loading) return <div id="loading">Loading&hellip;</div>;
      if (error) return <div id="error">{error.message}</div>;
      return <span id="data">{data}</span>;
    }

    function* Outer() {
      const [show, ss] = yield* useState(true);
      setShow = ss;
      return show ? ((<Inner />) as Child) : <span id="empty">gone</span>;
    }

    render(<Outer />, container);
    expect(container.querySelector("#loading")).not.toBeNull();

    // Unmount Inner
    void setShow(false);
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
      if (loading) return <div id="loading">Loading&hellip;</div>;
      return <span id="data">{data}</span>;
    }

    function* Outer() {
      const [show, ss] = yield* useState(true);
      setShow = ss;
      return show ? ((<Inner />) as Child) : <span id="empty">gone</span>;
    }

    render(<Outer />, container);
    expect(container.querySelector("#loading")).not.toBeNull();

    // Unmount Inner
    void setShow(false);
    expect(container.querySelector("#empty")).not.toBeNull();

    // Resolve the promise AFTER unmount — must not crash
    resolvePromise("Hello");
    await promise;

    expect(container.querySelector("#empty")?.textContent).toBe("gone");
  });
});
