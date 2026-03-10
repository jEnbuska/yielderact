import { $state } from "../hooks";
import { createElement, Fragment } from "../jsx";
import { buildNode, render } from "../render";

// jsdom is provided by jest-environment-jsdom (see jest.config.js)

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
    render(createElement("div", null), container);
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
  });

  it("renders a text child", () => {
    render(createElement("p", null, "Hello World"), container);
    expect(container.querySelector("p")?.textContent).toBe("Hello World");
  });

  it("renders nested elements", () => {
    render(createElement("div", null, createElement("span", null, "inner")), container);
    expect(container.querySelector("span")?.textContent).toBe("inner");
  });

  it("applies className", () => {
    render(createElement("div", { className: "foo bar" }), container);
    expect((container.firstChild as HTMLElement).className).toBe("foo bar");
  });

  it("applies arbitrary attributes", () => {
    render(createElement("input", { type: "text", placeholder: "name" }), container);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("placeholder")).toBe("name");
  });

  it("applies event listeners and wraps in SyntheticEvent", () => {
    const onClick = jest.fn();
    render(createElement("button", { onClick }, "click me"), container);
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
    render(createElement("div", { style: { color: "red", fontSize: "14px" } }), container);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBe("red");
    expect(el.style.fontSize).toBe("14px");
  });

  it("updates changed style properties on rerender", () => {
    let setStyle: (s: Record<string, string>) => void = () => {};

    function* Styled() {
      const [style, ss] = yield* $state<Record<string, string>>({ color: "red" });
      setStyle = ss;
      return createElement("div", { style });
    }

    render(createElement(Styled as never, {}), container);
    const el = container.querySelector("div") as HTMLElement;
    expect(el.style.color).toBe("red");

    setStyle({ color: "blue" });
    expect(el.style.color).toBe("blue");
  });

  it("removes style properties that are no longer present on rerender", () => {
    let setStyle: (s: Record<string, string>) => void = () => {};

    function* Styled() {
      const [style, ss] = yield* $state<Record<string, string>>({
        color: "red",
        fontSize: "14px",
      });
      setStyle = ss;
      return createElement("div", { style });
    }

    render(createElement(Styled as never, {}), container);
    const el = container.querySelector("div") as HTMLElement;
    expect(el.style.color).toBe("red");
    expect(el.style.fontSize).toBe("14px");

    setStyle({ color: "blue" });
    expect(el.style.color).toBe("blue");
    expect(el.style.fontSize).toBe("");
  });

  it("clears all styles when style prop is removed", () => {
    let setProps: (p: Record<string, unknown>) => void = () => {};

    function* Styled() {
      const [props, sp] = yield* $state<Record<string, unknown>>({
        style: { color: "red", fontWeight: "bold" },
      });
      setProps = sp;
      return createElement("div", props);
    }

    render(createElement(Styled as never, {}), container);
    const el = container.querySelector("div") as HTMLElement;
    expect(el.style.color).toBe("red");
    expect(el.style.fontWeight).toBe("bold");

    setProps({});
    expect(el.style.color).toBe("");
    expect(el.style.fontWeight).toBe("");
  });

  it("renders a Fragment with multiple children", () => {
    render(
      createElement(
        "ul",
        null,
        createElement(
          Fragment,
          null,
          createElement("li", null, "one"),
          createElement("li", null, "two"),
        ),
      ),
      container,
    );
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toBe("one");
    expect(items[1]?.textContent).toBe("two");
  });

  it("skips null and undefined children", () => {
    render(createElement("div", null, null, undefined, "visible"), container);
    expect(container.querySelector("div")?.textContent).toBe("visible");
  });

  it("sets input value as DOM property (not just attribute)", () => {
    let setValue: (v: string) => void = () => {};

    function* Controlled() {
      const [val, sv] = yield* $state("initial");
      setValue = sv;
      return createElement("input", { type: "text", value: val });
    }

    render(createElement(Controlled as never, {}), container);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("initial");

    setValue("updated");
    expect(input.value).toBe("updated");

    setValue("");
    expect(input.value).toBe("");
  });

  it("sets checkbox checked as DOM property", () => {
    let setChecked: (v: boolean) => void = () => {};

    function* CheckBox() {
      const [checked, sc] = yield* $state(false);
      setChecked = sc;
      return createElement("input", { type: "checkbox", checked });
    }

    render(createElement(CheckBox as never, {}), container);
    const cb = container.querySelector("input") as HTMLInputElement;
    expect(cb.checked).toBe(false);

    setChecked(true);
    expect(cb.checked).toBe(true);

    setChecked(false);
    expect(cb.checked).toBe(false);
  });
});

describe("buildNode", () => {
  it("returns a text node for strings", () => {
    const node = buildNode("hello");
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe("hello");
  });

  it("returns a text node for numbers", () => {
    const node = buildNode(42);
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe("42");
  });

  it("returns an empty text node for null", () => {
    const node = buildNode(null);
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe("");
  });

  it("returns an empty text node for false", () => {
    const node = buildNode(false);
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe("");
  });
});

describe("render – HTML defaults", () => {
  it('sets button type to "button" when not specified', () => {
    const node = buildNode(createElement("button", {}, "Click")) as HTMLButtonElement;
    expect(node.getAttribute("type")).toBe("button");
  });

  it("preserves explicit button type", () => {
    const node = buildNode(
      createElement("button", { type: "submit" }, "Submit"),
    ) as HTMLButtonElement;
    expect(node.getAttribute("type")).toBe("submit");
  });

  it('warns when <a target="_blank"> has no rel', () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    buildNode(createElement("a", { href: "https://example.com", target: "_blank" }, "link"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("noopener"));
    warn.mockRestore();
  });

  it('does not warn when <a target="_blank"> has any rel value', () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    buildNode(
      createElement(
        "a",
        { href: "https://example.com", target: "_blank", rel: "noopener noreferrer" },
        "link",
      ),
    );
    buildNode(
      createElement(
        "a",
        { href: "https://example.com", target: "_blank", rel: "noreferrer" },
        "link",
      ),
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn for <a> without target="_blank"', () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    buildNode(createElement("a", { href: "https://example.com" }, "link"));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
