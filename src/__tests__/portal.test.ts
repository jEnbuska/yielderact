import { createContext, useContext } from "../context";
import { useEffect, useState } from "../hooks";
import { createElement, createPortal, Portal } from "../jsx";
import { render } from "../render";

describe("createPortal", () => {
  let container: HTMLElement;
  let portalTarget: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    portalTarget = document.createElement("div");
    document.body.appendChild(container);
    document.body.appendChild(portalTarget);
  });

  afterEach(() => {
    document.body.removeChild(container);
    document.body.removeChild(portalTarget);
  });

  // ── 1. Basic rendering ──────────────────────────────────────────────────

  it("renders children into the portal container, not the source tree", () => {
    function* App() {
      return createPortal(createElement("span", null, "portal content"), portalTarget);
    }

    render(createElement(App as never, {}), container);

    expect(portalTarget.querySelector("span")?.textContent).toBe("portal content");
    expect(container.querySelector("span")).toBeNull();
  });

  // ── 2. Placeholder ──────────────────────────────────────────────────────

  it("places a Comment placeholder in the source tree at the portal position", () => {
    function* App() {
      return createElement(
        "div",
        null,
        createElement("span", null, "before"),
        createPortal(createElement("span", null, "portal"), portalTarget),
        createElement("span", null, "after"),
      );
    }

    render(createElement(App as never, {}), container);

    const div = container.querySelector("div");
    expect(div).not.toBeNull();
    // Should have: <span>before</span>, <!--portal-->, <span>after</span>
    const comments: Comment[] = [];
    for (let i = 0; i < (div as HTMLElement).childNodes.length; i++) {
      const node = (div as HTMLElement).childNodes[i];
      if (node?.nodeType === Node.COMMENT_NODE) {
        comments.push(node as Comment);
      }
    }
    expect(comments.length).toBeGreaterThanOrEqual(1);
    expect(comments.some((c) => c.textContent === "portal")).toBe(true);
  });

  // ── 3. Context inheritance ──────────────────────────────────────────────

  it("portal children see ancestor Provider values", () => {
    const Ctx = createContext("default");

    function* Consumer() {
      const value = yield* useContext(Ctx);
      return createElement("span", { className: "ctx-value" }, value);
    }

    function* App() {
      return createElement(
        Ctx.Provider as never,
        { value: "provided" },
        createPortal(createElement(Consumer as never, {}), portalTarget),
      );
    }

    render(createElement(App as never, {}), container);

    const span = portalTarget.querySelector(".ctx-value");
    expect(span?.textContent).toBe("provided");
  });

  // ── 4. Reconciliation ──────────────────────────────────────────────────

  it("updates portal children when the component rerenders", () => {
    let setter: (v: number) => void = () => {};

    function* App() {
      const [count, setCount] = yield* useState(0);
      setter = setCount as (v: number) => void;
      return createPortal(createElement("span", null, `count:${count}`), portalTarget);
    }

    render(createElement(App as never, {}), container);
    expect(portalTarget.querySelector("span")?.textContent).toBe("count:0");

    setter(1);
    expect(portalTarget.querySelector("span")?.textContent).toBe("count:1");
  });

  // ── 5. Unmount cleanup ──────────────────────────────────────────────────

  it("removes children from portal container when portal is removed", () => {
    let setter: (v: boolean) => void = () => {};

    function* App() {
      const [show, setShow] = yield* useState(true);
      setter = setShow as (v: boolean) => void;
      if (show) {
        return createPortal(createElement("span", null, "portal"), portalTarget);
      }
      return createElement("span", null, "no portal");
    }

    render(createElement(App as never, {}), container);
    expect(portalTarget.querySelector("span")?.textContent).toBe("portal");

    setter(false);
    expect(portalTarget.querySelector("span")).toBeNull();
    expect(container.querySelector("span")?.textContent).toBe("no portal");
  });

  // ── 6. Event delegation ─────────────────────────────────────────────────

  it("onClick in portal content fires correctly", () => {
    const onClick = vi.fn();

    function* App() {
      return createPortal(createElement("button", { onClick }, "click me"), portalTarget);
    }

    render(createElement(App as never, {}), container);
    portalTarget.querySelector("button")?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // ── 7. Multiple portals to same container ───────────────────────────────

  it("multiple portals to the same container render and clean up correctly", () => {
    let setter: (v: boolean) => void = () => {};

    function* App() {
      const [showSecond, setShowSecond] = yield* useState(true);
      setter = setShowSecond as (v: boolean) => void;
      return createElement(
        "div",
        null,
        createPortal(createElement("span", { className: "p1" }, "portal-1"), portalTarget),
        showSecond
          ? createPortal(createElement("span", { className: "p2" }, "portal-2"), portalTarget)
          : null,
      );
    }

    render(createElement(App as never, {}), container);
    expect(portalTarget.querySelectorAll("span").length).toBe(2);
    expect(portalTarget.querySelector(".p1")?.textContent).toBe("portal-1");
    expect(portalTarget.querySelector(".p2")?.textContent).toBe("portal-2");

    // Remove second portal
    setter(false);
    expect(portalTarget.querySelectorAll("span").length).toBe(1);
    expect(portalTarget.querySelector(".p1")?.textContent).toBe("portal-1");
    expect(portalTarget.querySelector(".p2")).toBeNull();
  });

  // ── 8. Keyed portals ────────────────────────────────────────────────────

  it("portals with key participate in keyed reconciliation", () => {
    let setter: (v: string[]) => void = () => {};

    function* App() {
      const [items, setItems] = yield* useState(["a", "b", "c"]);
      setter = setItems as (v: string[]) => void;
      return createElement(
        "div",
        null,
        ...items.map((item) =>
          createPortal(
            createElement("span", { className: `item-${item}` }, item),
            portalTarget,
            item,
          ),
        ),
      );
    }

    render(createElement(App as never, {}), container);
    expect(portalTarget.querySelectorAll("span").length).toBe(3);

    // Reorder: reverse
    setter(["c", "b", "a"]);
    expect(portalTarget.querySelectorAll("span").length).toBe(3);
    expect(portalTarget.querySelector(".item-a")?.textContent).toBe("a");
    expect(portalTarget.querySelector(".item-c")?.textContent).toBe("c");
  });

  // ── 9. Container change ─────────────────────────────────────────────────

  it("changing container moves children to the new container", () => {
    const secondTarget = document.createElement("div");
    document.body.appendChild(secondTarget);

    let setter: (v: Element) => void = () => {};

    function* App() {
      const [target, setTarget] = yield* useState<Element>(portalTarget);
      setter = setTarget as (v: Element) => void;
      return createPortal(createElement("span", null, "movable"), target);
    }

    render(createElement(App as never, {}), container);
    expect(portalTarget.querySelector("span")?.textContent).toBe("movable");
    expect(secondTarget.querySelector("span")).toBeNull();

    setter(secondTarget);
    expect(secondTarget.querySelector("span")?.textContent).toBe("movable");
    // Old container children are cleaned up by unmountSlot when the old portal
    // is replaced (the type is Portal but the container changed, so it's a fresh mount).
    expect(portalTarget.querySelector("span")).toBeNull();

    document.body.removeChild(secondTarget);
  });

  // ── 10. useEffect cleanup ───────────────────────────────────────────────

  it("effects in portal children run cleanup on unmount", () => {
    const cleanup = vi.fn();

    function* PortalChild() {
      yield* useEffect(() => {
        return cleanup;
      }, []);
      return createElement("span", null, "effect child");
    }

    let setter: (v: boolean) => void = () => {};

    function* App() {
      const [show, setShow] = yield* useState(true);
      setter = setShow as (v: boolean) => void;
      if (show) {
        return createPortal(createElement(PortalChild as never, {}), portalTarget);
      }
      return null;
    }

    render(createElement(App as never, {}), container);
    expect(portalTarget.querySelector("span")?.textContent).toBe("effect child");
    expect(cleanup).not.toHaveBeenCalled();

    setter(false);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(portalTarget.querySelector("span")).toBeNull();
  });

  // ── 11. Nested portals ──────────────────────────────────────────────────

  it("portal inside portal works correctly", () => {
    const innerTarget = document.createElement("div");
    document.body.appendChild(innerTarget);

    function* App() {
      return createPortal(
        createElement(
          "div",
          { className: "outer" },
          createElement("span", null, "outer content"),
          createPortal(createElement("span", null, "inner content"), innerTarget),
        ),
        portalTarget,
      );
    }

    render(createElement(App as never, {}), container);

    // Outer portal content in portalTarget
    expect(portalTarget.querySelector(".outer span")?.textContent).toBe("outer content");
    // Inner portal content in innerTarget
    expect(innerTarget.querySelector("span")?.textContent).toBe("inner content");
    // Nothing in source container
    expect(container.querySelector("span")).toBeNull();

    document.body.removeChild(innerTarget);
  });

  // ── createPortal API ────────────────────────────────────────────────────

  it("returns a VNode with type Portal", () => {
    const vnode = createPortal(createElement("span", null, "test"), portalTarget);
    expect(vnode.type).toBe(Portal);
    expect(vnode.props["$portalContainer"]).toBe(portalTarget);
    expect(vnode.children).toHaveLength(1);
  });

  it("wraps single child in array", () => {
    const vnode = createPortal(createElement("span", null, "single"), portalTarget);
    expect(Array.isArray(vnode.children)).toBe(true);
    expect(vnode.children).toHaveLength(1);
  });

  it("accepts array of children", () => {
    const vnode = createPortal(
      [createElement("span", null, "a"), createElement("span", null, "b")],
      portalTarget,
    );
    expect(vnode.children).toHaveLength(2);
  });

  it("sets key when key is provided", () => {
    const vnode = createPortal(createElement("span", null, "test"), portalTarget, "my-key");
    expect(vnode.props.key).toBe("my-key");
  });
});
