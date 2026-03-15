import { createContext, useContext } from "../context";
import { useState } from "../hooks";
import { createElement, Fragment } from "../jsx";
import { render } from "../render";

/**
 * Assert that the DOM subtree rooted at `root` contains no
 * <span style="display: contents"> wrapper elements.
 */
function expectNoDisplayContentsSpans(root: Node): void {
  if (root instanceof HTMLElement) {
    if (root.tagName === "SPAN" && root.style.display === "contents") {
      throw new Error(
        `Found <span style="display:contents"> in:\n${(root.parentNode as HTMLElement)?.innerHTML}`,
      );
    }
  }
  for (const child of root.childNodes) {
    expectNoDisplayContentsSpans(child);
  }
}

describe("no wrapper spans in rendered output", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // ── Components (no hooks) ──

  it("component returning a single element", () => {
    function* Greeting({ name }: { name: string }) {
      return createElement("h1", null, `Hello, ${name}!`);
    }
    render(createElement(Greeting as never, { name: "World" }), container);
    expect(container.querySelector("h1")?.textContent).toBe("Hello, World!");
    expectNoDisplayContentsSpans(container);
  });

  it("component returning null", () => {
    function* Empty() {
      return null;
    }
    render(createElement(Empty as never, {}), container);
    expectNoDisplayContentsSpans(container);
  });

  it("nested components (no hooks)", () => {
    function* Inner() {
      return createElement("span", null, "inner");
    }
    function* Outer() {
      return createElement("div", null, createElement(Inner as never, {}));
    }
    render(createElement(Outer as never, {}), container);
    expect(container.querySelector("span")?.textContent).toBe("inner");
    expectNoDisplayContentsSpans(container);
  });

  // ── Components ──

  it("component returning a single element", () => {
    function* Card() {
      return createElement("div", { className: "card" }, "content");
    }
    render(createElement(Card as never, {}), container);
    expect(container.querySelector(".card")?.textContent).toBe("content");
    expectNoDisplayContentsSpans(container);
  });

  it("component with useState", () => {
    let setCount: (v: number) => void = () => {};

    function* Counter() {
      const [count, sc] = yield* useState(0);
      setCount = sc;
      return createElement("button", {}, String(count));
    }

    render(createElement(Counter as never, {}), container);
    expect(container.querySelector("button")?.textContent).toBe("0");
    expectNoDisplayContentsSpans(container);

    setCount(5);
    expect(container.querySelector("button")?.textContent).toBe("5");
    expectNoDisplayContentsSpans(container);
  });

  it("nested components", () => {
    function* Inner() {
      return createElement("span", null, "hello");
    }
    function* Outer() {
      return createElement("div", null, createElement(Inner as never, {}));
    }
    render(createElement(Outer as never, {}), container);
    expect(container.querySelector("span")?.textContent).toBe("hello");
    expectNoDisplayContentsSpans(container);
  });

  it("component inside HTML element", () => {
    function* Label({ text }: { text: string }) {
      return createElement("span", null, text);
    }
    render(
      createElement("div", { className: "wrapper" }, createElement(Label as never, { text: "hi" })),
      container,
    );
    expect(container.querySelector("span")?.textContent).toBe("hi");
    expectNoDisplayContentsSpans(container);
  });

  // ── Multiple children / siblings ──

  it("multiple components as siblings", () => {
    function* A() {
      return createElement("p", null, "A");
    }
    function* B() {
      return createElement("p", null, "B");
    }
    render(
      createElement("div", null, createElement(A as never, {}), createElement(B as never, {})),
      container,
    );
    const ps = container.querySelectorAll("p");
    expect(ps).toHaveLength(2);
    expect(ps[0]?.textContent).toBe("A");
    expect(ps[1]?.textContent).toBe("B");
    expectNoDisplayContentsSpans(container);
  });

  it("mixed children: elements, text, and components", () => {
    function* GenChild() {
      return createElement("em", null, "gen");
    }
    function* PlainChild() {
      return createElement("strong", null, "plain");
    }
    render(
      createElement(
        "section",
        null,
        createElement("p", null, "text"),
        createElement(GenChild as never, {}),
        createElement(PlainChild as never, {}),
        "raw text",
      ),
      container,
    );
    expect(container.querySelector("p")?.textContent).toBe("text");
    expect(container.querySelector("em")?.textContent).toBe("gen");
    expect(container.querySelector("strong")?.textContent).toBe("plain");
    expectNoDisplayContentsSpans(container);
  });

  // ── Fragment ──

  it("generator returning Fragment with multiple children", () => {
    function* Multi() {
      return createElement(
        Fragment,
        null,
        createElement("p", null, "one"),
        createElement("p", null, "two"),
      );
    }
    render(createElement("div", null, createElement(Multi as never, {})), container);
    const ps = container.querySelectorAll("p");
    expect(ps).toHaveLength(2);
    expect(ps[0]?.textContent).toBe("one");
    expect(ps[1]?.textContent).toBe("two");
    expectNoDisplayContentsSpans(container);
  });

  // ── Context Providers ──

  it("context Provider with consumer", () => {
    const Ctx = createContext("default");

    function* Consumer() {
      const value = yield* useContext(Ctx);
      return createElement("span", null, value);
    }

    render(
      createElement(
        Ctx.Provider as never,
        { value: "provided" },
        createElement(Consumer as never, {}),
      ),
      container,
    );
    expect(container.querySelector("span")?.textContent).toBe("provided");
    expectNoDisplayContentsSpans(container);
  });

  it("nested Providers", () => {
    const Ctx = createContext("default");

    function* Consumer() {
      const value = yield* useContext(Ctx);
      return createElement("span", null, value);
    }

    render(
      createElement(
        Ctx.Provider as never,
        { value: "outer" },
        createElement(
          Ctx.Provider as never,
          { value: "inner" },
          createElement(Consumer as never, {}),
        ),
      ),
      container,
    );
    expect(container.querySelector("span")?.textContent).toBe("inner");
    expectNoDisplayContentsSpans(container);
  });

  // ── Deep nesting ──

  it("deeply nested: Provider > component > HTML > component > component", () => {
    const Ctx = createContext("ctx");

    function* Leaf() {
      const value = yield* useContext(Ctx);
      return createElement("b", null, value);
    }

    function* PlainWrapper({ children }: { children: unknown }) {
      return createElement("div", { className: "plain" }, ...(children as never[]));
    }

    function* Middle({ children }: { children: unknown }) {
      return createElement("article", null, ...(children as never[]));
    }

    render(
      createElement(
        Ctx.Provider as never,
        { value: "deep" },
        createElement(
          Middle as never,
          {},
          createElement(PlainWrapper as never, {}, createElement(Leaf as never, {})),
        ),
      ),
      container,
    );
    expect(container.querySelector("b")?.textContent).toBe("deep");
    expectNoDisplayContentsSpans(container);
  });

  // ── After rerender ──

  it("no wrappers after state-driven rerender with children swap", () => {
    let toggle: () => void = () => {};

    function* Child({ label }: { label: string }) {
      return createElement("span", null, label);
    }

    function* Parent() {
      const [on, setOn] = yield* useState(true);
      toggle = () => setOn(!on);
      return on
        ? createElement("div", null, createElement(Child as never, { label: "A" }))
        : createElement("div", null, createElement(Child as never, { label: "B" }));
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector("span")?.textContent).toBe("A");
    expectNoDisplayContentsSpans(container);

    toggle();
    expect(container.querySelector("span")?.textContent).toBe("B");
    expectNoDisplayContentsSpans(container);
  });
});
