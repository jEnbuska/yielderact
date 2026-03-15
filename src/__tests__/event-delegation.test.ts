import { useState } from "../hooks";
import { createElement } from "../jsx";
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
    const addSpy = jest.spyOn(container, "addEventListener");

    render(
      createElement(
        "div",
        null,
        createElement("button", { onClick: () => {} }, "A"),
        createElement("button", { onClick: () => {} }, "B"),
        createElement("button", { onClick: () => {} }, "C"),
      ),
      container,
    );

    // Only one "click" listener should be on the container
    const clickCalls = addSpy.mock.calls.filter(([type]) => type === "click");
    expect(clickCalls).toHaveLength(1);

    addSpy.mockRestore();
  });

  it("dispatches click events through delegation", () => {
    const onClick = jest.fn();
    render(createElement("button", { onClick }, "click me"), container);
    container.querySelector("button")?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("wraps events in SyntheticEvent with correct properties", () => {
    const onClick = jest.fn();
    render(createElement("button", { onClick }, "click me"), container);
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
      createElement(
        "div",
        {
          onClickCapture: () => order.push("outer-capture"),
          onClick: () => order.push("outer-bubble"),
        },
        createElement(
          "button",
          {
            onClickCapture: () => order.push("inner-capture"),
            onClick: () => order.push("inner-bubble"),
          },
          "click",
        ),
      ),
      container,
    );

    container.querySelector("button")?.click();

    expect(order).toEqual(["outer-capture", "inner-capture", "inner-bubble", "outer-bubble"]);
  });

  // ── stopPropagation ──────────────────────────────────────────────────────

  it("stopPropagation halts synthetic bubble dispatch", () => {
    const outerClick = jest.fn();
    const innerClick = jest.fn((e: { stopPropagation(): void }) => {
      e.stopPropagation();
    });

    render(
      createElement(
        "div",
        { onClick: outerClick },
        createElement("button", { onClick: innerClick }, "click"),
      ),
      container,
    );

    container.querySelector("button")?.click();

    expect(innerClick).toHaveBeenCalledTimes(1);
    expect(outerClick).not.toHaveBeenCalled();
  });

  it("stopPropagation in capture phase stops bubble phase", () => {
    const outerCapture = jest.fn((e: { stopPropagation(): void }) => {
      e.stopPropagation();
    });
    const innerCapture = jest.fn();
    const innerBubble = jest.fn();
    const outerBubble = jest.fn();

    render(
      createElement(
        "div",
        { onClickCapture: outerCapture, onClick: outerBubble },
        createElement("button", { onClickCapture: innerCapture, onClick: innerBubble }, "click"),
      ),
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
      createElement(
        "div",
        {
          onClickCapture: (e: { stopImmediatePropagation(): void }) => {
            order.push("outer-capture");
            e.stopImmediatePropagation();
          },
          onClick: () => order.push("outer-bubble"),
        },
        createElement("button", { onClick: () => order.push("inner-bubble") }, "click"),
      ),
      container,
    );

    container.querySelector("button")?.click();

    expect(order).toEqual(["outer-capture"]);
  });

  // ── preventDefault ──────────────────────────────────────────────────────

  it("preventDefault calls native preventDefault", () => {
    let defaultPrevented = false;

    render(
      createElement(
        "button",
        {
          onClick: (e: { preventDefault(): void; isDefaultPrevented(): boolean }) => {
            e.preventDefault();
            defaultPrevented = e.isDefaultPrevented();
          },
        },
        "click",
      ),
      container,
    );

    container.querySelector("button")?.click();
    expect(defaultPrevented).toBe(true);
  });

  // ── currentTarget ───────────────────────────────────────────────────────

  it("currentTarget is correct at each step in the dispatch", () => {
    const targets: Array<EventTarget | null> = [];

    render(
      createElement(
        "div",
        {
          id: "outer",
          onClick: (e: { currentTarget: EventTarget | null }) => {
            targets.push(e.currentTarget);
          },
        },
        createElement(
          "button",
          {
            id: "inner",
            onClick: (e: { currentTarget: EventTarget | null }) => {
              targets.push(e.currentTarget);
            },
          },
          "click",
        ),
      ),
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
      return createElement(
        "button",
        {
          onClick: () => {
            setA(a + 1);
            setB(b + 1);
          },
        },
        `${a}-${b}`,
      );
    }

    render(createElement(Multi as never, {}), container);
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
    const onScroll = jest.fn();
    render(createElement("div", { onScroll }, "content"), container);

    const div = container.querySelector("div") as HTMLElement;
    const addSpy = jest.spyOn(div, "addEventListener");

    // The scroll listener should have been added directly to the element,
    // NOT to the root container. We can verify by checking the container
    // doesn't have a scroll listener.
    const containerAddSpy = jest.spyOn(container, "addEventListener");

    // Re-render to check that additional scroll elements don't add root listeners
    render(createElement("div", { onScroll: jest.fn() }, "content2"), container);

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
      createElement(
        "button",
        {
          onClick: (e: Record<string, unknown>) => {
            receivedEvent = e;
          },
        },
        "click",
      ),
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
    const onDoubleClick = jest.fn();
    render(createElement("button", { onDoubleClick }, "dblclick me"), container);

    const btn = container.querySelector("button") as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("onFocus maps to focusin DOM event (delegated)", () => {
    const onFocus = jest.fn();
    render(createElement("input", { onFocus }), container);

    const input = container.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("onBlur maps to focusout DOM event (delegated)", () => {
    const onBlur = jest.fn();
    render(createElement("input", { onBlur }), container);

    const input = container.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  // ── Delegation with nested components ─────────────────────────────────

  it("works with components that rerender on click", () => {
    function* Counter() {
      const [count, setCount] = yield* useState(0);
      return createElement("button", { onClick: () => setCount(count + 1) }, String(count));
    }

    render(createElement(Counter as never, {}), container);
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
      return createElement("button", { onClick: handler }, String(count));
    }

    render(createElement(HandlerChanger as never, {}), container);
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
      createElement(
        "div",
        {
          id: "level1",
          onClick: () => order.push("level1"),
        },
        createElement(
          "div",
          {
            id: "level2",
            onClick: () => order.push("level2"),
          },
          createElement(
            "div",
            {
              id: "level3",
              onClick: () => order.push("level3"),
            },
            createElement(
              "button",
              {
                id: "target",
                onClick: () => order.push("target"),
              },
              "click",
            ),
          ),
        ),
      ),
      container,
    );

    container.querySelector("button")?.click();

    expect(order).toEqual(["target", "level3", "level2", "level1"]);
  });
});
