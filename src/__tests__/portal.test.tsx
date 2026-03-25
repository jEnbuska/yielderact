import { createContext, useContext } from "../context";
import { useEffect, useState } from "../hooks";
import { createPortal, Portal } from "../jsx";
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
      return createPortal(<span>portal content</span>, portalTarget);
    }

    render(<App />, container);

    expect(portalTarget.querySelector("span")?.textContent).toBe("portal content");
    expect(container.querySelector("span")).toBeNull();
  });

  // ── 2. Placeholder ──────────────────────────────────────────────────────

  it("places a Comment placeholder in the source tree at the portal position", () => {
    function* App() {
      return (
        <div>
          <span>before</span>
          {createPortal(<span>portal</span>, portalTarget)}
          <span>after</span>
        </div>
      );
    }

    render(<App />, container);

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
      return <span className="ctx-value">{value}</span>;
    }

    function* App() {
      return <div $context={Ctx("provided")}>{createPortal(<Consumer />, portalTarget)}</div>;
    }

    render(<App />, container);

    const span = portalTarget.querySelector(".ctx-value");
    expect(span?.textContent).toBe("provided");
  });

  // ── 4. Reconciliation ──────────────────────────────────────────────────

  it("updates portal children when the component rerenders", () => {
    let setter: (v: number) => void = () => {};

    function* App() {
      const [count, setCount] = yield* useState(0);
      setter = setCount as (v: number) => void;
      return createPortal(<span>{`count:${count}`}</span>, portalTarget);
    }

    render(<App />, container);
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
        return createPortal(<span>portal</span>, portalTarget);
      }
      return <span>no portal</span>;
    }

    render(<App />, container);
    expect(portalTarget.querySelector("span")?.textContent).toBe("portal");

    setter(false);
    expect(portalTarget.querySelector("span")).toBeNull();
    expect(container.querySelector("span")?.textContent).toBe("no portal");
  });

  // ── 6. Event delegation ─────────────────────────────────────────────────

  it("onClick in portal content fires correctly", () => {
    const onClick = vi.fn();

    function* App() {
      return createPortal(<button onClick={onClick}>click me</button>, portalTarget);
    }

    render(<App />, container);
    portalTarget.querySelector("button")?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // ── 7. Multiple portals to same container ───────────────────────────────

  it("multiple portals to the same container render and clean up correctly", () => {
    let setter: (v: boolean) => void = () => {};

    function* App() {
      const [showSecond, setShowSecond] = yield* useState(true);
      setter = setShowSecond as (v: boolean) => void;
      return (
        <div>
          {createPortal(<span className="p1">portal-1</span>, portalTarget)}
          {showSecond ? createPortal(<span className="p2">portal-2</span>, portalTarget) : null}
        </div>
      );
    }

    render(<App />, container);
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
      return (
        <div>
          {...items.map((item) =>
            createPortal(<span className={`item-${item}`}>{item}</span>, portalTarget, item),
          )}
        </div>
      );
    }

    render(<App />, container);
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
      return createPortal(<span>movable</span>, target);
    }

    render(<App />, container);
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
      return <span>effect child</span>;
    }

    let setter: (v: boolean) => void = () => {};

    function* App() {
      const [show, setShow] = yield* useState(true);
      setter = setShow as (v: boolean) => void;
      if (show) {
        return createPortal(<PortalChild />, portalTarget);
      }
      return null;
    }

    render(<App />, container);
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
        <div className="outer">
          <span>outer content</span>
          {createPortal(<span>inner content</span>, innerTarget)}
        </div>,
        portalTarget,
      );
    }

    render(<App />, container);

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
    const vnode = createPortal(<span>test</span>, portalTarget);
    expect(vnode.type).toBe(Portal);
    expect(vnode.props["$portalContainer"]).toBe(portalTarget);
    expect(vnode.children).toHaveLength(1);
  });

  it("wraps single child in array", () => {
    const vnode = createPortal(<span>single</span>, portalTarget);
    expect(Array.isArray(vnode.children)).toBe(true);
    expect(vnode.children).toHaveLength(1);
  });

  it("accepts array of children", () => {
    const vnode = createPortal([<span>a</span>, <span>b</span>], portalTarget);
    expect(vnode.children).toHaveLength(2);
  });

  it("sets key when key is provided", () => {
    const vnode = createPortal(<span>test</span>, portalTarget, "my-key");
    expect(vnode.props.key).toBe("my-key");
  });
});
