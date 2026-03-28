import type { Context } from "../context";
import { useState } from "../hooks";
import { createElement, Fragment } from "../jsx";
import { buildNode, render } from "../render";
import { driveWithContext } from "../render/driver";
import { Scheduler, SchedulerCtx } from "../render/scheduler";

function run(child: Parameters<typeof buildNode>[0]) {
  const map: Map<Context, unknown> = new Map();
  const scheduler = new Scheduler();
  map.set(SchedulerCtx as Context, scheduler);
  const wrapped = driveWithContext(map, buildNode(child));
  let result = wrapped.next();
  while (!result.done) {
    result = wrapped.next(undefined);
  }
  return result.value;
}

// jsdom is provided by vitest (see vitest.config.ts)

describe("render – HTML elements", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders a plain element", () => {
    render(<div />, container);
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
  });

  it("renders a text child", () => {
    render(<p>Hello World</p>, container);
    expect(container.querySelector("p")?.textContent).toBe("Hello World");
  });

  it("renders nested elements", () => {
    render(
      <div>
        <span>inner</span>
      </div>,
      container,
    );
    expect(container.querySelector("span")?.textContent).toBe("inner");
  });

  it("applies className", () => {
    render(<div className="foo bar" />, container);
    expect((container.firstChild as HTMLElement).className).toBe("foo bar");
  });

  it("applies arbitrary attributes", () => {
    render(<input type="text" placeholder="name" />, container);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("placeholder")).toBe("name");
  });

  it("applies event listeners and wraps in SyntheticEvent", () => {
    const onClick = vi.fn();
    render(<button onClick={onClick}>click me</button>, container);
    container.querySelector("button")?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    // The handler receives a SyntheticEvent, not the raw native event
    const syntheticEvent = onClick.mock.calls[0][0];
    expect(syntheticEvent).toHaveProperty("nativeEvent");
    expect(syntheticEvent).toHaveProperty("type", "click");
    expect(typeof syntheticEvent.preventDefault).toBe("function");
    expect(typeof syntheticEvent.stopPropagation).toBe("function");
  });

  it("applies inline styles", () => {
    render(<div style={{ color: "red", fontSize: "14px" }} />, container);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBe("red");
    expect(el.style.fontSize).toBe("14px");
  });

  it("updates changed style properties on rerender", () => {
    let setStyle: (s: Record<string, string>) => void = () => {};

    function* Styled() {
      const [style, ss] = yield* useState<Record<string, string>>({ color: "red" });
      setStyle = ss;
      return <div style={style} />;
    }

    render(<Styled />, container);
    const el = container.querySelector("div") as HTMLElement;
    expect(el.style.color).toBe("red");

    void setStyle({ color: "blue" });
    expect(el.style.color).toBe("blue");
  });

  it("removes style properties that are no longer present on rerender", () => {
    let setStyle: (s: Record<string, string>) => void = () => {};

    function* Styled() {
      const [style, ss] = yield* useState<Record<string, string>>({
        color: "red",
        fontSize: "14px",
      });
      setStyle = ss;
      return <div style={style} />;
    }

    render(<Styled />, container);
    const el = container.querySelector("div") as HTMLElement;
    expect(el.style.color).toBe("red");
    expect(el.style.fontSize).toBe("14px");

    void setStyle({ color: "blue" });
    expect(el.style.color).toBe("blue");
    expect(el.style.fontSize).toBe("");
  });

  it("clears all styles when style prop is removed", () => {
    let setProps: (p: Record<string, unknown>) => void = () => {};

    function* Styled() {
      const [props, sp] = yield* useState<Record<string, unknown>>({
        style: { color: "red", fontWeight: "bold" },
      });
      setProps = sp;
      return createElement("div", props);
    }

    render(<Styled />, container);
    const el = container.querySelector("div") as HTMLElement;
    expect(el.style.color).toBe("red");
    expect(el.style.fontWeight).toBe("bold");

    void setProps({});
    expect(el.style.color).toBe("");
    expect(el.style.fontWeight).toBe("");
  });

  it("renders a Fragment with multiple children", () => {
    render(
      <ul>
        <Fragment>
          <li>one</li>
          <li>two</li>
        </Fragment>
      </ul>,
      container,
    );
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toBe("one");
    expect(items[1]?.textContent).toBe("two");
  });

  it("skips null and undefined children", () => {
    render(
      <div>
        {null}
        {undefined}
        {"visible"}
      </div>,
      container,
    );
    expect(container.querySelector("div")?.textContent).toBe("visible");
  });

  it("sets input value as DOM property (not just attribute)", () => {
    let setValue: (v: string) => void = () => {};

    function* Controlled() {
      const [val, sv] = yield* useState("initial");
      setValue = sv;
      return <input type="text" value={val} />;
    }

    render(<Controlled />, container);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("initial");

    void setValue("updated");
    expect(input.value).toBe("updated");

    void setValue("");
    expect(input.value).toBe("");
  });

  it("sets checkbox checked as DOM property", () => {
    let setChecked: (v: boolean) => void = () => {};

    function* CheckBox() {
      const [checked, sc] = yield* useState(false);
      setChecked = sc;
      return <input type="checkbox" checked={checked} />;
    }

    render(<CheckBox />, container);
    const cb = container.querySelector("input") as HTMLInputElement;
    expect(cb.checked).toBe(false);

    void setChecked(true);
    expect(cb.checked).toBe(true);

    void setChecked(false);
    expect(cb.checked).toBe(false);
  });
});

describe("buildNode", () => {
  it("returns a text node for strings", () => {
    const node = run("hello");
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe("hello");
  });

  it("returns a text node for numbers", () => {
    const node = run(42);
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe("42");
  });

  it("returns an empty text node for null", () => {
    const node = run(null);
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe("");
  });

  it("returns an empty text node for false", () => {
    const node = run(false);
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe("");
  });
});

describe("render – HTML defaults", () => {
  it('sets button type to "button" when not specified', () => {
    const node = run(<button>Click</button>) as HTMLButtonElement;
    expect(node.getAttribute("type")).toBe("button");
  });

  it("preserves explicit button type", () => {
    const node = run(<button type="submit">Submit</button>) as HTMLButtonElement;
    expect(node.getAttribute("type")).toBe("submit");
  });

  it('warns when <a target="_blank"> has no rel', () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    run(
      <a href="https://example.com" target="_blank">
        link
      </a>,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("noopener"));
    warn.mockRestore();
  });

  it('does not warn when <a target="_blank"> has any rel value', () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    run(
      <a href="https://example.com" target="_blank" rel="noopener noreferrer">
        link
      </a>,
    );
    run(
      <a href="https://example.com" target="_blank" rel="noreferrer">
        link
      </a>,
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn for <a> without target="_blank"', () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    run(<a href="https://example.com">link</a>);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
