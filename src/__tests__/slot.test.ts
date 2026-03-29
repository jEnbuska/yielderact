import { useContext } from "../context";
import { useMemo } from "../hooks/useMemo";
import { createElement } from "../jsx";
import { render } from "../render";
import { createSlot, useSlotContent } from "../slot";

/** Flush microtask queue so queueMicrotask callbacks execute. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

describe("Slot API", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("literal Fill provides content to useContext(slot) consumer", () => {
    const slot = createSlot();

    function* Consumer() {
      const content = yield* useContext(slot);
      return createElement("span", { "data-testid": "out" }, content);
    }

    render(
      createElement(
        slot.Provider as never,
        null,
        createElement(slot.Fill as never, null, "hello from fill"),
        createElement(Consumer as never, null),
      ),
      container,
    );

    expect(container.querySelector("[data-testid='out']")?.textContent).toBe("hello from fill");
  });

  it("literal Fill provides content to useSlotContent consumer", () => {
    const slot = createSlot();

    function* Consumer() {
      const content = yield* useSlotContent(slot);
      return createElement("span", { "data-testid": "out" }, content);
    }

    render(
      createElement(
        slot.Provider as never,
        null,
        createElement(slot.Fill as never, null, "slot content"),
        createElement(Consumer as never, null),
      ),
      container,
    );

    expect(container.querySelector("[data-testid='out']")?.textContent).toBe("slot content");
  });

  it("Fill-as-component provides content (Fill after Consumer)", async () => {
    const slot = createSlot();

    function* Consumer() {
      const content = yield* useSlotContent(slot);
      return createElement("span", { "data-testid": "out" }, content ?? "empty");
    }

    function* FillContent() {
      return createElement(slot.Fill as never, null, "dynamic fill");
    }

    render(
      createElement(
        slot.Provider as never,
        null,
        createElement(Consumer as never, null),
        createElement(FillContent as never, null),
      ),
      container,
    );

    // After microtask, the Fill's useEffect triggers setContent -> rerender
    await flushMicrotasks();
    // Allow the scheduler to process
    await new Promise((r) => setTimeout(r, 10));

    expect(container.querySelector("[data-testid='out']")?.textContent).toBe("dynamic fill");
  });

  it("Fill-as-component provides content (Fill before Consumer)", () => {
    const slot = createSlot();

    function* Consumer() {
      const content = yield* useSlotContent(slot);
      return createElement("span", { "data-testid": "out" }, content ?? "empty");
    }

    function* FillContent() {
      return createElement(slot.Fill as never, null, "before fill");
    }

    render(
      createElement(
        slot.Provider as never,
        null,
        createElement(FillContent as never, null),
        createElement(Consumer as never, null),
      ),
      container,
    );

    // Fill runs before Consumer, so registry.content is set synchronously
    expect(container.querySelector("[data-testid='out']")?.textContent).toBe("before fill");
  });

  it("useSlotContent returns null when no Fill", () => {
    const slot = createSlot();

    function* Consumer() {
      const content = yield* useSlotContent(slot);
      return createElement(
        "span",
        { "data-testid": "out" },
        content === null ? "null" : "has-content",
      );
    }

    render(
      createElement(slot.Provider as never, null, createElement(Consumer as never, null)),
      container,
    );

    expect(container.querySelector("[data-testid='out']")?.textContent).toBe("null");
  });

  it("multiple consumers all receive slot content", () => {
    const slot = createSlot();

    function* Consumer(props: { id: string }) {
      const content = yield* useSlotContent(slot);
      return createElement("span", { "data-testid": props.id }, content);
    }

    render(
      createElement(
        slot.Provider as never,
        null,
        createElement(slot.Fill as never, null, "shared"),
        createElement(Consumer as never, { id: "a" }),
        createElement(Consumer as never, { id: "b" }),
      ),
      container,
    );

    expect(container.querySelector("[data-testid='a']")?.textContent).toBe("shared");
    expect(container.querySelector("[data-testid='b']")?.textContent).toBe("shared");
  });

  it("nested providers shadow correctly", () => {
    const slot = createSlot();

    function* Consumer(props: { id: string }) {
      const content = yield* useContext(slot);
      return createElement("span", { "data-testid": props.id }, content);
    }

    render(
      createElement(
        slot.Provider as never,
        null,
        createElement(slot.Fill as never, null, "outer"),
        createElement(Consumer as never, { id: "outer-consumer" }),
        createElement(
          slot.Provider as never,
          null,
          createElement(slot.Fill as never, null, "inner"),
          createElement(Consumer as never, { id: "inner-consumer" }),
        ),
      ),
      container,
    );

    expect(container.querySelector("[data-testid='outer-consumer']")?.textContent).toBe("outer");
    expect(container.querySelector("[data-testid='inner-consumer']")?.textContent).toBe("inner");
  });

  it("hooks can be called after useSlotContent", () => {
    const slot = createSlot();

    function* Consumer() {
      const content = yield* useSlotContent(slot);
      const memo = yield* useMemo(() => "memoized", []);
      return createElement("span", { "data-testid": "out" }, content, "-", memo);
    }

    render(
      createElement(
        slot.Provider as never,
        null,
        createElement(slot.Fill as never, null, "slot"),
        createElement(Consumer as never, null),
      ),
      container,
    );

    expect(container.querySelector("[data-testid='out']")?.textContent).toBe("slot-memoized");
  });

  it("useContext(slot) works for backward compat", () => {
    const slot = createSlot();

    function* Consumer() {
      const content = yield* useContext(slot);
      return createElement("span", { "data-testid": "out" }, content);
    }

    render(
      createElement(
        slot.Provider as never,
        null,
        createElement(slot.Fill as never, null, "ctx-content"),
        createElement(Consumer as never, null),
      ),
      container,
    );

    expect(container.querySelector("[data-testid='out']")?.textContent).toBe("ctx-content");
  });
});
