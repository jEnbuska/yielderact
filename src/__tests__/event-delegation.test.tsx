import { useState } from "../hooks";
import { render } from "../render";

describe("event delegation", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // ── Basic delegation ──────────────────────────────────────────────────────

  it("only one native listener per event type on root", () => {
    const addSpy = vi.spyOn(container, "addEventListener");

    render(
      <div>
        <button onClick={() => {}}>A</button>
        <button onClick={() => {}}>B</button>
        <button onClick={() => {}}>C</button>
      </div>,
      container,
    );

    // Only one "click" listener should be on the container
    const clickCalls = addSpy.mock.calls.filter(([type]) => type === "click");
    expect(clickCalls).toHaveLength(1);

    addSpy.mockRestore();
  });

  it("dispatches click events through delegation", () => {
    const onClick = vi.fn();
    render(<button onClick={onClick}>click me</button>, container);
    container.querySelector("button")?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("wraps events in SyntheticEvent with correct properties", () => {
    const onClick = vi.fn();
    render(<button onClick={onClick}>click me</button>, container);
    container.querySelector("button")?.click();

    const syntheticEvent = onClick.mock.calls[0]?.[0];
    expect(syntheticEvent).toHaveProperty("nativeEvent");
    expect(syntheticEvent).toHaveProperty("type", "click");
    expect(typeof syntheticEvent.preventDefault).toBe("function");
    expect(typeof syntheticEvent.stopPropagation).toBe("function");
    expect(typeof syntheticEvent.stopImmediatePropagation).toBe("function");
    expect(typeof syntheticEvent.isPropagationStopped).toBe("function");
    expect(typeof syntheticEvent.isDefaultPrevented).toBe("function");
  });

  // ── Capture → bubble order ────────────────────────────────────────────────

  it("fires capture handlers before bubble handlers (root→target→root)", () => {
    const order: string[] = [];

    render(
      <div
        onClickCapture={() => order.push("outer-capture")}
        onClick={() => order.push("outer-bubble")}
      >
        <button
          onClickCapture={() => order.push("inner-capture")}
          onClick={() => order.push("inner-bubble")}
        >
          click
        </button>
      </div>,
      container,
    );

    container.querySelector("button")?.click();

    expect(order).toEqual(["outer-capture", "inner-capture", "inner-bubble", "outer-bubble"]);
  });

  // ── stopPropagation ──────────────────────────────────────────────────────

  it("stopPropagation halts synthetic bubble dispatch", () => {
    const outerClick = vi.fn();
    const innerClick = vi.fn((e: { stopPropagation(): void }) => {
      e.stopPropagation();
    });

    render(
      <div onClick={outerClick}>
        <button onClick={innerClick}>click</button>
      </div>,
      container,
    );

    container.querySelector("button")?.click();

    expect(innerClick).toHaveBeenCalledTimes(1);
    expect(outerClick).not.toHaveBeenCalled();
  });

  it("stopPropagation in capture phase stops bubble phase", () => {
    const outerCapture = vi.fn((e: { stopPropagation(): void }) => {
      e.stopPropagation();
    });
    const innerCapture = vi.fn();
    const innerBubble = vi.fn();
    const outerBubble = vi.fn();

    render(
      <div onClickCapture={outerCapture} onClick={outerBubble}>
        <button onClickCapture={innerCapture} onClick={innerBubble}>
          click
        </button>
      </div>,
      container,
    );

    container.querySelector("button")?.click();

    expect(outerCapture).toHaveBeenCalledTimes(1);
    expect(innerCapture).not.toHaveBeenCalled();
    expect(innerBubble).not.toHaveBeenCalled();
    expect(outerBubble).not.toHaveBeenCalled();
  });

  // ── stopImmediatePropagation ──────────────────────────────────────────────

  it("stopImmediatePropagation stops all further dispatch", () => {
    const order: string[] = [];

    // We'll use capture on outer and bubble on inner to test cross-phase
    render(
      <div
        onClickCapture={(e: { stopImmediatePropagation(): void }) => {
          order.push("outer-capture");
          e.stopImmediatePropagation();
        }}
        onClick={() => order.push("outer-bubble")}
      >
        <button onClick={() => order.push("inner-bubble")}>click</button>
      </div>,
      container,
    );

    container.querySelector("button")?.click();

    expect(order).toEqual(["outer-capture"]);
  });

  // ── preventDefault ──────────────────────────────────────────────────────

  it("preventDefault calls native preventDefault", () => {
    let defaultPrevented = false;

    render(
      <button
        onClick={(e: { preventDefault(): void; isDefaultPrevented(): boolean }) => {
          e.preventDefault();
          defaultPrevented = e.isDefaultPrevented();
        }}
      >
        click
      </button>,
      container,
    );

    container.querySelector("button")?.click();
    expect(defaultPrevented).toBe(true);
  });

  // ── currentTarget ───────────────────────────────────────────────────────

  it("currentTarget is correct at each step in the dispatch", () => {
    const targets: Array<EventTarget | null> = [];

    render(
      <div
        id="outer"
        onClick={(e: { currentTarget: EventTarget | null }) => {
          targets.push(e.currentTarget);
        }}
      >
        <button
          id="inner"
          onClick={(e: { currentTarget: EventTarget | null }) => {
            targets.push(e.currentTarget);
          }}
        >
          click
        </button>
      </div>,
      container,
    );

    container.querySelector("button")?.click();

    // Bubble phase: button first, then outer div
    expect(targets).toHaveLength(2);
    expect((targets[0] as HTMLElement).id).toBe("inner");
    expect((targets[1] as HTMLElement).id).toBe("outer");
  });

  // ── Batching ──────────────────────────────────────────────────────────

  it("batches multiple setState calls during one event into one render", () => {
    let renderCount = 0;

    function* Multi() {
      const [a, setA] = yield* useState(0);
      const [b, setB] = yield* useState(0);
      renderCount++;
      return (
        <button
          onClick={() => {
            setA(a + 1);
            setB(b + 1);
          }}
        >
          {`${a}-${b}`}
        </button>
      );
    }

    render(<Multi />, container);
    expect(renderCount).toBe(1);
    expect(container.querySelector("button")?.textContent).toBe("0-0");

    container.querySelector("button")?.click();
    // After click, both state updates should have been processed
    expect(container.querySelector("button")?.textContent).toBe("1-1");
    // Should have rendered only twice total (initial + one batched rerender)
    expect(renderCount).toBe(2);
  });

  // ── Non-delegated events ──────────────────────────────────────────────

  it("scroll event is attached per-element (non-delegated)", () => {
    const onScroll = vi.fn();
    render(<div onScroll={onScroll}>content</div>, container);

    const div = container.querySelector("div") as HTMLElement;
    const addSpy = vi.spyOn(div, "addEventListener");

    // The scroll listener should have been added directly to the element,
    // NOT to the root container. We can verify by checking the container
    // doesn't have a scroll listener.
    const containerAddSpy = vi.spyOn(container, "addEventListener");

    // Re-render to check that additional scroll elements don't add root listeners
    render(<div onScroll={vi.fn()}>content2</div>, container);

    // Container should not get a "scroll" listener
    const scrollOnContainer = containerAddSpy.mock.calls.filter(([type]) => type === "scroll");
    expect(scrollOnContainer).toHaveLength(0);

    addSpy.mockRestore();
    containerAddSpy.mockRestore();
  });

  // ── Proxy: native properties accessible ──────────────────────────────

  it("native event properties are accessible through SyntheticEvent proxy", () => {
    let receivedEvent: Record<string, unknown> | null = null;

    render(
      <button
        onClick={(e: Record<string, unknown>) => {
          receivedEvent = e;
        }}
      >
        click
      </button>,
      container,
    );

    container.querySelector("button")?.click();

    expect(receivedEvent).not.toBeNull();
    // bubbles is a standard property that our proxy should forward
    expect(receivedEvent?.["bubbles"]).toBe(true);
    // type should be accessible
    expect(receivedEvent?.["type"]).toBe("click");
  });

  // ── Event prop mapping ────────────────────────────────────────────────

  it("onDoubleClick maps to dblclick DOM event", () => {
    const onDoubleClick = vi.fn();
    render(<button onDoubleClick={onDoubleClick}>dblclick me</button>, container);

    const btn = container.querySelector("button") as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("onFocus maps to focusin DOM event (delegated)", () => {
    const onFocus = vi.fn();
    render(<input onFocus={onFocus} />, container);

    const input = container.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("onBlur maps to focusout DOM event (delegated)", () => {
    const onBlur = vi.fn();
    render(<input onBlur={onBlur} />, container);

    const input = container.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  // ── Delegation with nested components ─────────────────────────────────

  it("works with components that rerender on click", () => {
    function* Counter() {
      const [count, setCount] = yield* useState(0);
      return <button onClick={() => setCount(count + 1)}>{String(count)}</button>;
    }

    render(<Counter />, container);
    expect(container.querySelector("button")?.textContent).toBe("0");

    container.querySelector("button")?.click();
    expect(container.querySelector("button")?.textContent).toBe("1");

    container.querySelector("button")?.click();
    expect(container.querySelector("button")?.textContent).toBe("2");
  });

  it("handles handler changes across rerenders", () => {
    const handlers: Array<() => void> = [];

    function* HandlerChanger() {
      const [count, setCount] = yield* useState(0);
      const handler = () => {
        handlers.push(handler);
        setCount(count + 1);
      };
      return <button onClick={handler}>{String(count)}</button>;
    }

    render(<HandlerChanger />, container);
    const btn = container.querySelector("button") as HTMLButtonElement;

    btn.click();
    expect(btn.textContent).toBe("1");

    btn.click();
    expect(btn.textContent).toBe("2");

    // Each click should have used a different handler (new closure each render)
    expect(handlers).toHaveLength(2);
    expect(handlers[0]).not.toBe(handlers[1]);
  });

  // ── Deep nesting ──────────────────────────────────────────────────────

  it("dispatches through deeply nested elements", () => {
    const order: string[] = [];

    render(
      <div id="level1" onClick={() => order.push("level1")}>
        <div id="level2" onClick={() => order.push("level2")}>
          <div id="level3" onClick={() => order.push("level3")}>
            <button id="target" onClick={() => order.push("target")}>
              click
            </button>
          </div>
        </div>
      </div>,
      container,
    );

    container.querySelector("button")?.click();

    expect(order).toEqual(["target", "level3", "level2", "level1"]);
  });
});
