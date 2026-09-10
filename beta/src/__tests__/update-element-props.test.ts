/**
 * Commit-writer contract for `updateElementProps`.
 *
 * These tests run against real jsdom elements to pin the DOM side of the
 * patch contract — the diff tests (`diff-element-props.test.ts`) cover
 * patch shape, this file covers "given this patch, the DOM looks like X."
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DelegationRoot, getHandlers } from "../render/delegation";
import { type ElementPatch, updateElementProps, type WeakRefLike } from "../render/element-props";

function makeRoot(): { container: Element; delegationRoot: DelegationRoot } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const delegationRoot = new DelegationRoot(container, () => {});
  return { container, delegationRoot };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("updateElementProps: style", () => {
  it("applies a full-replace style object to an element with no prior inline styles", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    container.appendChild(el);

    const patch: ElementPatch = { style: { color: "rgb(255, 0, 0)", paddingLeft: "4px" } };
    updateElementProps(el, patch, delegationRoot);

    expect(el.style.color).toBe("rgb(255, 0, 0)");
    expect(el.style.paddingLeft).toBe("4px");
  });

  it("applies a delta style object — new values land, '' entries clear", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    el.style.color = "red";
    el.style.padding = "4px";
    container.appendChild(el);

    const patch: ElementPatch = { style: { color: "blue", padding: "" } };
    updateElementProps(el, patch, delegationRoot);

    expect(el.style.color).toBe("blue");
    expect(el.style.padding).toBe("");
  });

  it("clears all inline styles when style is null", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    el.style.color = "red";
    el.style.padding = "4px";
    container.appendChild(el);

    updateElementProps(el, { style: null }, delegationRoot);

    expect(el.style.cssText).toBe("");
    expect(el.style.color).toBe("");
    expect(el.style.padding).toBe("");
  });
});

describe("updateElementProps: custom properties", () => {
  it("sets a CSS custom property from the style object", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    container.appendChild(el);

    updateElementProps(el, { style: { "--dos-cols": "1fr 2fr" } }, delegationRoot);

    expect(el.style.getPropertyValue("--dos-cols")).toBe("1fr 2fr");
  });

  it("sets custom properties alongside regular ones", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    container.appendChild(el);

    updateElementProps(el, { style: { "--gap": "4px", color: "rgb(255, 0, 0)" } }, delegationRoot);

    expect(el.style.getPropertyValue("--gap")).toBe("4px");
    expect(el.style.color).toBe("rgb(255, 0, 0)");
  });

  it("clears a custom property when the delta sets it to an empty string", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    container.appendChild(el);

    updateElementProps(el, { style: { "--gap": "4px" } }, delegationRoot);
    updateElementProps(el, { style: { "--gap": "" } }, delegationRoot);

    expect(el.style.getPropertyValue("--gap")).toBe("");
  });
});

describe("updateElementProps: attrs", () => {
  it("writes setAttrs entries to the DOM", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    container.appendChild(el);

    updateElementProps(
      el,
      { setAttrs: { id: "hello", title: "hi", className: "foo bar" } },
      delegationRoot,
    );

    expect(el.id).toBe("hello");
    expect(el.getAttribute("title")).toBe("hi");
    expect(el.className).toBe("foo bar");
  });

  it("removes entries listed in removeAttrs", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    el.setAttribute("title", "bye");
    el.className = "old";
    container.appendChild(el);

    updateElementProps(el, { removeAttrs: ["title", "className"] }, delegationRoot);

    expect(el.hasAttribute("title")).toBe(false);
    expect(el.className).toBe("");
  });

  it("translates htmlFor to the `for` attribute on label elements", () => {
    const { container, delegationRoot } = makeRoot();
    const label = document.createElement("label");
    container.appendChild(label);

    updateElementProps(label, { setAttrs: { htmlFor: "email-input" } }, delegationRoot);
    expect(label.getAttribute("for")).toBe("email-input");

    updateElementProps(label, { removeAttrs: ["htmlFor"] }, delegationRoot);
    expect(label.hasAttribute("for")).toBe(false);
  });
});

describe("updateElementProps: events", () => {
  it("registers a handler in the delegation registry for setEvents entries", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("button");
    container.appendChild(el);

    const onClick = () => {};
    updateElementProps(el, { setEvents: { onClick } }, delegationRoot);

    expect(getHandlers(el, "click")?.bubble).toBe(onClick);
  });

  it("clears the handler for removeEvents entries", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("button");
    container.appendChild(el);

    const onClick = () => {};
    updateElementProps(el, { setEvents: { onClick } }, delegationRoot);
    expect(getHandlers(el, "click")?.bubble).toBe(onClick);

    updateElementProps(el, { removeEvents: ["onClick"] }, delegationRoot);
    expect(getHandlers(el, "click")).toBeUndefined();
  });

  it("event swap: remove runs before set, so final registered handler is the new one", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("button");
    container.appendChild(el);

    const prevHandler = () => {};
    const nextHandler = () => {};

    updateElementProps(el, { setEvents: { onClick: prevHandler } }, delegationRoot);
    expect(getHandlers(el, "click")?.bubble).toBe(prevHandler);

    // The swap patch emitted by diffElementProps — bucket order matters.
    updateElementProps(
      el,
      {
        removeEvents: ["onClick"],
        setEvents: { onClick: nextHandler },
      },
      delegationRoot,
    );

    expect(getHandlers(el, "click")?.bubble).toBe(nextHandler);
  });

  it("capture-variant props register on the capture side", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("button");
    container.appendChild(el);

    const handler = () => {};
    updateElementProps(el, { setEvents: { onClickCapture: handler } }, delegationRoot);

    expect(getHandlers(el, "click")?.capture).toBe(handler);
    expect(getHandlers(el, "click")?.bubble).toBeUndefined();
  });
});

describe("updateElementProps: refSwap", () => {
  it("clears prev.current and sets next.current to the element", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    container.appendChild(el);

    const prev: WeakRefLike = { current: el };
    const next: WeakRefLike = { current: null };

    updateElementProps(el, { refSwap: { prev, next } }, delegationRoot);

    expect(prev.current).toBeUndefined();
    expect(next.current).toBe(el);
  });

  it("handles a swap where only next is provided", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    container.appendChild(el);

    const next: WeakRefLike = { current: null };
    updateElementProps(el, { refSwap: { prev: undefined, next } }, delegationRoot);

    expect(next.current).toBe(el);
  });

  it("handles a swap where only prev is provided (ref was removed)", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    container.appendChild(el);

    const prev: WeakRefLike = { current: el };
    updateElementProps(el, { refSwap: { prev, next: undefined } }, delegationRoot);

    expect(prev.current).toBeUndefined();
  });
});

describe("updateElementProps: bucket ordering", () => {
  it("runs removeAttrs before setAttrs (same key re-added)", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    el.setAttribute("title", "old");
    container.appendChild(el);

    // Contrived: the diff never emits this exact shape, but if a caller ever
    // did, the bucket order matters. We assert the final visible state.
    updateElementProps(el, { removeAttrs: ["title"], setAttrs: { title: "new" } }, delegationRoot);

    expect(el.getAttribute("title")).toBe("new");
  });

  it("applies every bucket in a combined patch correctly", () => {
    const { container, delegationRoot } = makeRoot();
    const el = document.createElement("div");
    el.setAttribute("title", "old");
    el.style.color = "red";
    container.appendChild(el);

    const prevHandler = () => {};
    const nextHandler = () => {};
    updateElementProps(el, { setEvents: { onClick: prevHandler } }, delegationRoot);

    const nextRef: WeakRefLike = { current: null };
    updateElementProps(
      el,
      {
        removeAttrs: ["title"],
        setAttrs: { id: "new" },
        removeEvents: ["onClick"],
        setEvents: { onClick: nextHandler },
        style: { color: "blue" },
        refSwap: { prev: undefined, next: nextRef },
      },
      delegationRoot,
    );

    expect(el.hasAttribute("title")).toBe(false);
    expect(el.id).toBe("new");
    expect(getHandlers(el, "click")?.bubble).toBe(nextHandler);
    expect(el.style.color).toBe("blue");
    expect(nextRef.current).toBe(el);
  });
});
