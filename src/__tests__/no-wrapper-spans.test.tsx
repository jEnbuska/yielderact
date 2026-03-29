import { createContext, useContext } from "../context";
import { useState } from "../hooks";
import { Fragment } from "../jsx";
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
      return <h1>{`Hello, ${name}!`}</h1>;
    }
    render(<Greeting name="World" />, container);
    expect(container.querySelector("h1")?.textContent).toBe("Hello, World!");
    expectNoDisplayContentsSpans(container);
  });

  it("component returning null", () => {
    function* Empty() {
      return null;
    }
    render(<Empty />, container);
    expectNoDisplayContentsSpans(container);
  });

  it("nested components (no hooks)", () => {
    function* Inner() {
      return <span>inner</span>;
    }
    function* Outer() {
      return (
        <div>
          <Inner />
        </div>
      );
    }
    render(<Outer />, container);
    expect(container.querySelector("span")?.textContent).toBe("inner");
    expectNoDisplayContentsSpans(container);
  });

  // ── Components ──

  it("component returning a single element", () => {
    function* Card() {
      return <div className="card">content</div>;
    }
    render(<Card />, container);
    expect(container.querySelector(".card")?.textContent).toBe("content");
    expectNoDisplayContentsSpans(container);
  });

  it("component with useState", async () => {
    let setCount: (v: number) => void = () => {};

    function* Counter() {
      const [count, sc] = yield* useState(0);
      setCount = sc;
      return <button>{String(count)}</button>;
    }

    render(<Counter />, container);
    expect(container.querySelector("button")?.textContent).toBe("0");
    expectNoDisplayContentsSpans(container);

    void setCount(5);
    await Promise.resolve();
    expect(container.querySelector("button")?.textContent).toBe("5");
    expectNoDisplayContentsSpans(container);
  });

  it("nested components", () => {
    function* Inner() {
      return <span>hello</span>;
    }
    function* Outer() {
      return (
        <div>
          <Inner />
        </div>
      );
    }
    render(<Outer />, container);
    expect(container.querySelector("span")?.textContent).toBe("hello");
    expectNoDisplayContentsSpans(container);
  });

  it("component inside HTML element", () => {
    function* Label({ text }: { text: string }) {
      return <span>{text}</span>;
    }
    render(
      <div className="wrapper">
        <Label text="hi" />
      </div>,
      container,
    );
    expect(container.querySelector("span")?.textContent).toBe("hi");
    expectNoDisplayContentsSpans(container);
  });

  // ── Multiple children / siblings ──

  it("multiple components as siblings", () => {
    function* A() {
      return <p>A</p>;
    }
    function* B() {
      return <p>B</p>;
    }
    render(
      <div>
        <A />
        <B />
      </div>,
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
      return <em>gen</em>;
    }
    function* PlainChild() {
      return <strong>plain</strong>;
    }
    render(
      <section>
        <p>text</p>
        <GenChild />
        <PlainChild />
        {"raw text"}
      </section>,
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
      return (
        <Fragment>
          <p>one</p>
          <p>two</p>
        </Fragment>
      );
    }
    render(
      <div>
        <Multi />
      </div>,
      container,
    );
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
      return <span>{value}</span>;
    }

    render(<Consumer $context={Ctx("provided")} />, container);
    expect(container.querySelector("span")?.textContent).toBe("provided");
    expectNoDisplayContentsSpans(container);
  });

  it("nested Providers", () => {
    const Ctx = createContext("default");

    function* Consumer() {
      const value = yield* useContext(Ctx);
      return <span>{value}</span>;
    }

    render(
      <div $context={Ctx("outer")}>
        <Consumer $context={Ctx("inner")} />
      </div>,
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
      return <b>{value}</b>;
    }

    function* PlainWrapper({ children }: { children: unknown }) {
      return <div className="plain">{...(children as never[])}</div>;
    }

    function* Middle({ children }: { children: unknown }) {
      return <article>{...(children as never[])}</article>;
    }

    render(
      <Middle $context={Ctx("deep")}>
        <PlainWrapper>
          <Leaf />
        </PlainWrapper>
      </Middle>,
      container,
    );
    expect(container.querySelector("b")?.textContent).toBe("deep");
    expectNoDisplayContentsSpans(container);
  });

  // ── After rerender ──

  it("no wrappers after state-driven rerender with children swap", async () => {
    let toggle: () => void = () => {};

    function* Child({ label }: { label: string }) {
      return <span>{label}</span>;
    }

    function* Parent() {
      const [on, setOn] = yield* useState(true);
      toggle = () => setOn(!on);
      return on ? (
        <div>
          <Child label="A" />
        </div>
      ) : (
        <div>
          <Child label="B" />
        </div>
      );
    }

    render(<Parent />, container);
    expect(container.querySelector("span")?.textContent).toBe("A");
    expectNoDisplayContentsSpans(container);

    toggle();
    await Promise.resolve();
    expect(container.querySelector("span")?.textContent).toBe("B");
    expectNoDisplayContentsSpans(container);
  });
});
