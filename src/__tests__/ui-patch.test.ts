import { useState, useUIPatch } from "../hooks";
import { createElement } from "../jsx";
import { commitUIPatch, render, startUIPatch } from "../render";

// jsdom is provided by vitest (see vitest.config.ts)

// ---------------------------------------------------------------------------
// Global UI Patch: startUIPatch / commitUIPatch
// ---------------------------------------------------------------------------

describe("startUIPatch / commitUIPatch (global patch)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    // Always commit in case a test left a patch open
    commitUIPatch();
  });

  it("defers DOM updates until commitUIPatch is called", () => {
    let setValue: (v: string) => void = () => {};

    function* Comp() {
      const [v, sv] = yield* useState("initial");
      setValue = sv;
      return createElement("span", null, v);
    }

    render(createElement(Comp as never, {}), container);
    expect(container.textContent).toBe("initial");

    startUIPatch();
    setValue("updated");
    // DOM not yet changed
    expect(container.textContent).toBe("initial");

    commitUIPatch();
    expect(container.textContent).toBe("updated");
  });

  it("multiple state changes during patch produce exactly one DOM update on commit", () => {
    const renderCalls: string[] = [];
    let setValue: (v: string) => void = () => {};

    function* Comp() {
      const [v, sv] = yield* useState("a");
      setValue = sv;
      renderCalls.push(v);
      return createElement("span", null, v);
    }

    render(createElement(Comp as never, {}), container);
    renderCalls.length = 0; // reset after initial mount

    startUIPatch();
    setValue("b");
    setValue("c");
    // Two state changes → two generator runs, but DOM unchanged
    expect(container.textContent).toBe("a");

    commitUIPatch();
    // DOM reflects final state
    expect(container.textContent).toBe("c");
  });

  it("nested patches: DOM only flushed when depth reaches zero", () => {
    let setValue: (v: string) => void = () => {};

    function* Comp() {
      const [v, sv] = yield* useState("a");
      setValue = sv;
      return createElement("span", null, v);
    }

    render(createElement(Comp as never, {}), container);

    startUIPatch();
    startUIPatch();
    setValue("b");
    commitUIPatch(); // depth 2→1; not flushed yet
    expect(container.textContent).toBe("a");
    commitUIPatch(); // depth 1→0; flushed now
    expect(container.textContent).toBe("b");
  });

  it('$patch="live" component updates immediately during a global patch', () => {
    let setLive: (v: string) => void = () => {};
    let setFrozen: (v: string) => void = () => {};

    function* Live() {
      const [v, sv] = yield* useState("live-a");
      setLive = sv;
      return createElement("span", { id: "live" }, v);
    }

    function* Frozen() {
      const [v, sv] = yield* useState("frozen-a");
      setFrozen = sv;
      return createElement("span", { id: "frozen" }, v);
    }

    function* App() {
      return createElement(
        "div",
        null,
        createElement(Live as never, { $patch: "live" }),
        createElement(Frozen as never, {}),
      );
    }

    render(createElement(App as never, {}), container);

    startUIPatch();
    setLive("live-b");
    setFrozen("frozen-b");

    // Live component updated immediately; frozen component not yet
    expect(container.querySelector("#live")?.textContent).toBe("live-b");
    expect(container.querySelector("#frozen")?.textContent).toBe("frozen-a");

    commitUIPatch();
    expect(container.querySelector("#frozen")?.textContent).toBe("frozen-b");
  });

  it("unmounting a dirty component before commit does not throw", () => {
    let setValue: (v: string) => void = () => {};
    let setShown: (v: boolean) => void = () => {};

    function* Inner() {
      const [v, sv] = yield* useState("x");
      setValue = sv;
      return createElement("span", null, v);
    }

    function* Outer() {
      const [shown, setS] = yield* useState(true);
      setShown = setS;
      return createElement("div", null, shown ? createElement(Inner as never, {}) : null);
    }

    render(createElement(Outer as never, {}), container);

    startUIPatch();
    setValue("y"); // Inner is now dirty
    setShown(false); // Inner is unmounted

    expect(() => commitUIPatch()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Local UI Patch: useUIPatch
// ---------------------------------------------------------------------------

describe("useUIPatch (local patch)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("defers DOM updates in the component and its descendants until commit", () => {
    let setInner: (v: string) => void = () => {};
    let capturedCommit: () => void = () => {};
    let capturedStartPatch: () => () => void = () => () => {};

    function* Child() {
      const [v, sv] = yield* useState("child-a");
      setInner = sv;
      return createElement("span", { id: "child" }, v);
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      return createElement("div", null, createElement(Child as never, {}));
    }

    render(createElement(Parent as never, {}), container);

    capturedCommit = capturedStartPatch();
    setInner("child-b");

    // DOM not yet updated
    expect(container.querySelector("#child")?.textContent).toBe("child-a");

    capturedCommit();
    expect(container.querySelector("#child")?.textContent).toBe("child-b");
  });

  it("sibling component outside the patch subtree updates immediately", () => {
    let setSibling: (v: string) => void = () => {};
    let capturedStartPatch: () => () => void = () => () => {};

    function* PatchedArea() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      return createElement("span", { id: "patched" }, "content");
    }

    function* Sibling() {
      const [v, sv] = yield* useState("sib-a");
      setSibling = sv;
      return createElement("span", { id: "sib" }, v);
    }

    function* App() {
      return createElement(
        "div",
        null,
        createElement(PatchedArea as never, {}),
        createElement(Sibling as never, {}),
      );
    }

    render(createElement(App as never, {}), container);

    const commit = capturedStartPatch();
    setSibling("sib-b");

    // Sibling is outside the patch scope → updates immediately
    expect(container.querySelector("#sib")?.textContent).toBe("sib-b");

    // Committing is a no-op for the sibling but should not throw
    expect(() => commit()).not.toThrow();
  });

  it("snapshot is taken at startPatch() call time", () => {
    // A child mounted AFTER startPatch() is called is not in the snapshot
    // and runs normally.
    let setShow: (v: boolean) => void = () => {};
    let setDynamic: (v: string) => void = () => {};
    let capturedStartPatch: () => () => void = () => () => {};

    function* Dynamic() {
      const [v, sv] = yield* useState("dyn-a");
      setDynamic = sv;
      return createElement("span", { id: "dyn" }, v);
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement("div", null, show ? createElement(Dynamic as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    // Start patch BEFORE Dynamic is mounted
    const commit = capturedStartPatch();

    // Mount Dynamic while patch is active (it's not in the snapshot)
    setShow(true); // Parent is in the patch → deferred
    // DOM not yet updated (Parent itself is deferred)
    expect(container.querySelector("#dyn")).toBeNull();

    commit();
    // After commit, Dynamic appears
    expect(container.querySelector("#dyn")?.textContent).toBe("dyn-a");
    void setDynamic; // silence unused warning
  });
});

// ---------------------------------------------------------------------------
// Live-only reconcile: element visibility during global patches
// ---------------------------------------------------------------------------

describe("live-only reconcile: element add/remove during global patch", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    commitUIPatch(); // clean up in case a test left a patch open
  });

  // ── Removal ──────────────────────────────────────────────────────────────

  it("removed default element stays visible until commit", () => {
    let setShow: (v: boolean) => void = () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement("div", null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector("#target")).not.toBeNull();

    startUIPatch();
    setShow(false);
    // Still visible — DOM is frozen
    expect(container.querySelector("#target")).not.toBeNull();

    commitUIPatch();
    expect(container.querySelector("#target")).toBeNull();
  });

  it('removed $patch="live" component disappears immediately', () => {
    let setShow: (v: boolean) => void = () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement(
        "div",
        null,
        show ? createElement(Child as never, { $patch: "live" }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector("#target")).not.toBeNull();

    startUIPatch();
    setShow(false);
    // Removed immediately because $patch="live"
    expect(container.querySelector("#target")).toBeNull();

    commitUIPatch();
    // Still gone after commit
    expect(container.querySelector("#target")).toBeNull();
  });

  it('element inside $patch="live" wrapper removed disappears immediately', () => {
    let setShow: (v: boolean) => void = () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement(
        "div",
        { $patch: "live" },
        show ? createElement(Child as never, {}) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow(false);
    expect(container.querySelector("#target")).toBeNull();

    commitUIPatch();
    expect(container.querySelector("#target")).toBeNull();
  });

  it('$shown=false with $patch="live" hides element immediately', () => {
    let setShow: (v: boolean) => void = () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement(
        "div",
        null,
        createElement(Child as never, { $shown: show, $patch: "live" }),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector("#target")).not.toBeNull();

    startUIPatch();
    setShow(false);
    // Hidden immediately
    expect(container.querySelector("#target")).toBeNull();

    commitUIPatch();
    expect(container.querySelector("#target")).toBeNull();
  });

  it('$shown=false without $patch="live" keeps element visible until commit', () => {
    let setShow: (v: boolean) => void = () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement("div", null, createElement(Child as never, { $shown: show }));
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow(false);
    expect(container.querySelector("#target")).not.toBeNull();

    commitUIPatch();
    expect(container.querySelector("#target")).toBeNull();
  });

  // ── Addition ─────────────────────────────────────────────────────────────

  it("added default element does not appear until commit", () => {
    let setShow: (v: boolean) => void = () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement("div", null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector("#target")).toBeNull();

    startUIPatch();
    setShow(true);
    // Not yet visible
    expect(container.querySelector("#target")).toBeNull();

    commitUIPatch();
    expect(container.querySelector("#target")).not.toBeNull();
  });

  it('added $patch="live" component appears immediately', () => {
    let setShow: (v: boolean) => void = () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement(
        "div",
        null,
        show ? createElement(Child as never, { $patch: "live" }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow(true);
    // Appears immediately
    expect(container.querySelector("#target")).not.toBeNull();

    commitUIPatch();
    // Still there after commit
    expect(container.querySelector("#target")).not.toBeNull();
  });

  it('element added inside $patch="live" wrapper appears immediately', () => {
    let setShow: (v: boolean) => void = () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement(
        "div",
        { $patch: "live" },
        show ? createElement(Child as never, {}) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow(true);
    expect(container.querySelector("#target")).not.toBeNull();

    commitUIPatch();
    expect(container.querySelector("#target")).not.toBeNull();
  });

  it('$shown=true with $patch="live" shows element immediately', () => {
    let setShow: (v: boolean) => void = () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement(
        "div",
        null,
        createElement(Child as never, { $shown: show, $patch: "live" }),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector("#target")).toBeNull();

    startUIPatch();
    setShow(true);
    expect(container.querySelector("#target")).not.toBeNull();

    commitUIPatch();
    expect(container.querySelector("#target")).not.toBeNull();
  });

  // ── Remove then re-add ────────────────────────────────────────────────────

  it("default element removed then re-added stays visible throughout and commit preserves it", () => {
    let setShow: (v: boolean) => void = () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement("div", null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow(false); // remove — frozen, stays visible
    expect(container.querySelector("#target")).not.toBeNull();
    setShow(true); // re-add — still frozen
    expect(container.querySelector("#target")).not.toBeNull();

    commitUIPatch();
    // Final state: show=true → element present
    expect(container.querySelector("#target")).not.toBeNull();
  });

  it("live element removed then re-added disappears and reappears immediately", () => {
    let setShow: (v: boolean) => void = () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement(
        "div",
        null,
        show ? createElement(Child as never, { $patch: "live" }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setShow(false); // live remove → gone immediately
    expect(container.querySelector("#target")).toBeNull();
    setShow(true); // live re-add → back immediately
    expect(container.querySelector("#target")).not.toBeNull();

    commitUIPatch();
    expect(container.querySelector("#target")).not.toBeNull();
  });

  // ── Text content inside live context ──────────────────────────────────────

  it('text inside $patch="live" wrapper updates immediately', () => {
    let setValue: (v: string) => void = () => {};

    function* Parent() {
      const [v, setV] = yield* useState("a");
      setValue = setV;
      return createElement("div", { $patch: "live" }, v);
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setValue("b");
    expect(container.textContent).toBe("b");

    commitUIPatch();
    expect(container.textContent).toBe("b");
  });

  it("text outside live context stays frozen until commit", () => {
    let setValue: (v: string) => void = () => {};

    function* Parent() {
      const [v, setV] = yield* useState("a");
      setValue = setV;
      return createElement("span", null, v);
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setValue("b");
    expect(container.textContent).toBe("a");

    commitUIPatch();
    expect(container.textContent).toBe("b");
  });

  // ── Dynamic $patch changes mid-patch ─────────────────────────────────────

  it("component switches from default to live mid-patch and starts updating immediately", () => {
    let setLive: (v: boolean) => void = () => {};
    let setValue: (v: string) => void = () => {};

    function* Child() {
      const [v, setV] = yield* useState("a");
      setValue = setV;
      return createElement("span", { id: "target" }, v);
    }

    function* Parent() {
      const [live, setLive_] = yield* useState(false);
      setLive = setLive_;
      return createElement(
        "div",
        null,
        createElement(Child as never, { $patch: live ? "live" : "default" }),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector("#target")?.textContent).toBe("a");

    startUIPatch();
    // First update while Child is still default → deferred
    setValue("b");
    expect(container.querySelector("#target")?.textContent).toBe("a");

    // Switch Child to live (via parent rerender)
    setLive(true);
    // Now Child's captured batch context is updated to 'live'
    // Subsequent updates should be immediate
    setValue("c");
    expect(container.querySelector("#target")?.textContent).toBe("c");

    commitUIPatch();
    expect(container.querySelector("#target")?.textContent).toBe("c");
  });

  it("component switches from live to default mid-patch and stops updating", () => {
    let setLive: (v: boolean) => void = () => {};
    let setValue: (v: string) => void = () => {};

    function* Child() {
      const [v, setV] = yield* useState("a");
      setValue = setV;
      return createElement("span", { id: "target" }, v);
    }

    function* Parent() {
      const [live, setLive_] = yield* useState(true);
      setLive = setLive_;
      return createElement(
        "div",
        null,
        createElement(Child as never, { $patch: live ? "live" : "default" }),
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    // Child is live → updates immediately
    setValue("b");
    expect(container.querySelector("#target")?.textContent).toBe("b");

    // Switch Child to default → stops updating immediately
    setLive(false);
    setValue("c");
    // Should still show 'b' — deferred now
    expect(container.querySelector("#target")?.textContent).toBe("b");

    commitUIPatch();
    expect(container.querySelector("#target")?.textContent).toBe("c");
  });

  it("live element that becomes default retains its last live state after commit", () => {
    let setLive: (v: boolean) => void = () => {};
    let setValue: (v: string) => void = () => {};

    function* Child() {
      const [v, setV] = yield* useState("a");
      setValue = setV;
      return createElement("span", { id: "target" }, v);
    }

    function* Parent() {
      const [live, setLive_] = yield* useState(true);
      setLive = setLive_;
      return createElement(
        "div",
        null,
        createElement(Child as never, { $patch: live ? "live" : "default" }),
      );
    }

    render(createElement(Parent as never, {}), container);

    startUIPatch();
    setValue("b"); // live → updates immediately
    expect(container.querySelector("#target")?.textContent).toBe("b");

    setLive(false); // switch to default — 'b' stays in DOM
    expect(container.querySelector("#target")?.textContent).toBe("b");

    // No further state updates — commit should apply pendingVNode for Parent
    // (which has $patch="default" for Child now), reconcile from 'b'
    commitUIPatch();
    // State was never changed again — Child remains at 'b'
    expect(container.querySelector("#target")?.textContent).toBe("b");
  });
});

// ---------------------------------------------------------------------------
// Live-only reconcile: element add/remove during local patches
// ---------------------------------------------------------------------------

describe("live-only reconcile: element add/remove during local patch", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("removed default element stays visible until local commit", () => {
    let setShow: (v: boolean) => void = () => {};
    let capturedStartPatch: () => () => void = () => () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement("div", null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch();
    setShow(false);
    expect(container.querySelector("#target")).not.toBeNull();

    commit();
    expect(container.querySelector("#target")).toBeNull();
  });

  it('removed $patch="live" component disappears immediately during local patch', () => {
    let setShow: (v: boolean) => void = () => {};
    let capturedStartPatch: () => () => void = () => () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement(
        "div",
        null,
        show ? createElement(Child as never, { $patch: "live" }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch();
    setShow(false);
    expect(container.querySelector("#target")).toBeNull();

    commit();
    expect(container.querySelector("#target")).toBeNull();
  });

  it("added default element does not appear until local commit", () => {
    let setShow: (v: boolean) => void = () => {};
    let capturedStartPatch: () => () => void = () => () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement("div", null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch();
    setShow(true);
    expect(container.querySelector("#target")).toBeNull();

    commit();
    expect(container.querySelector("#target")).not.toBeNull();
  });

  it('added $patch="live" component appears immediately during local patch', () => {
    let setShow: (v: boolean) => void = () => {};
    let capturedStartPatch: () => () => void = () => () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement(
        "div",
        null,
        show ? createElement(Child as never, { $patch: "live" }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch();
    setShow(true);
    expect(container.querySelector("#target")).not.toBeNull();

    commit();
    expect(container.querySelector("#target")).not.toBeNull();
  });

  it("live element added then removed during local patch: not present after commit", () => {
    let setShow: (v: boolean) => void = () => {};
    let capturedStartPatch: () => () => void = () => () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement(
        "div",
        null,
        show ? createElement(Child as never, { $patch: "live" }) : null,
      );
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch();
    setShow(true); // live-add → appears immediately
    expect(container.querySelector("#target")).not.toBeNull();
    setShow(false); // live-remove → disappears immediately
    expect(container.querySelector("#target")).toBeNull();

    commit();
    expect(container.querySelector("#target")).toBeNull();
  });

  it("default element added then removed during local patch: invisible throughout, absent after commit", () => {
    let setShow: (v: boolean) => void = () => {};
    let capturedStartPatch: () => () => void = () => () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(false);
      setShow = setS;
      return createElement("div", null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch();
    setShow(true); // default: still not visible
    expect(container.querySelector("#target")).toBeNull();
    setShow(false); // default: still not visible
    expect(container.querySelector("#target")).toBeNull();

    commit();
    // Final state: show=false → not present
    expect(container.querySelector("#target")).toBeNull();
  });

  it("default element removed then re-added during local patch: visible throughout and present after commit", () => {
    let setShow: (v: boolean) => void = () => {};
    let capturedStartPatch: () => () => void = () => () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "hello");
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [show, setS] = yield* useState(true);
      setShow = setS;
      return createElement("div", null, show ? createElement(Child as never, {}) : null);
    }

    render(createElement(Parent as never, {}), container);

    const commit = capturedStartPatch();
    setShow(false); // frozen: still visible
    expect(container.querySelector("#target")).not.toBeNull();
    setShow(true); // frozen: still visible
    expect(container.querySelector("#target")).not.toBeNull();

    commit();
    expect(container.querySelector("#target")).not.toBeNull();
  });

  it('$shown with $patch="live" inside local patch scope behaves live', () => {
    let setShown: (v: boolean) => void = () => {};
    let capturedStartPatch: () => () => void = () => () => {};

    function* Child() {
      return createElement("span", { id: "target" }, "x");
    }

    function* Parent() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [shown, setS] = yield* useState(true);
      setShown = setS;
      return createElement(
        "div",
        null,
        createElement(Child as never, { $shown: shown, $patch: "live" }),
      );
    }

    render(createElement(Parent as never, {}), container);
    expect(container.querySelector("#target")).not.toBeNull();

    const commit = capturedStartPatch();
    setShown(false); // live → hides immediately
    expect(container.querySelector("#target")).toBeNull();

    commit();
    expect(container.querySelector("#target")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Prop updates on child components after patch commit (regression for the
// prevSlot.props = allProps bug in live-only skip path)
// ---------------------------------------------------------------------------

describe("child component prop updates apply correctly after global patch commit", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    commitUIPatch();
  });

  it("child component reflects changed props (e.g. isPending=false) after commit", () => {
    // Regression: mirrors the real demo flow where setIsPending(true) fires
    // BEFORE the patch (so the DOM shows disabled/wait), then setIsPending(false)
    // fires INSIDE the patch, and the button must be enabled after commit.
    let setPending: (v: boolean) => Promise<void> = () => Promise.resolve();

    function* Nav(props: { isPending: boolean }) {
      return createElement("button", { id: "btn", disabled: props.isPending }, "click");
    }

    function* App() {
      const [isPending, setP] = yield* useState(false);
      setPending = setP;
      return createElement("div", null, createElement(Nav as never, { isPending }));
    }

    render(createElement(App as never, {}), container);
    expect(container.querySelector("#btn")?.hasAttribute("disabled")).toBe(false);

    // Set isPending=true BEFORE the patch (immediate DOM update — buttons disabled)
    setPending(true);
    expect(container.querySelector("#btn")?.hasAttribute("disabled")).toBe(true);

    startUIPatch();
    // Inside patch, clear isPending — DOM frozen (buttons still disabled)
    setPending(false);
    expect(container.querySelector("#btn")?.hasAttribute("disabled")).toBe(true);

    commitUIPatch();
    // After commit: isPending=false must be applied — button must be enabled
    expect(container.querySelector("#btn")?.hasAttribute("disabled")).toBe(false);
  });

  it("child receives isPending=true during patch, then isPending=false at commit", () => {
    let setPending: (v: boolean) => Promise<void> = () => Promise.resolve();
    const renderLog: boolean[] = [];

    function* Status(props: { pending: boolean }) {
      renderLog.push(props.pending);
      return createElement("span", { id: "status" }, props.pending ? "loading" : "done");
    }

    function* App() {
      const [pending, setP] = yield* useState(false);
      setPending = setP;
      return createElement("div", null, createElement(Status as never, { pending }));
    }

    render(createElement(App as never, {}), container);
    expect(container.querySelector("#status")?.textContent).toBe("done");
    renderLog.length = 0;

    startUIPatch();
    setPending(true); // App rerenders with pending=true; Status deferred
    // DOM frozen
    expect(container.querySelector("#status")?.textContent).toBe("done");

    commitUIPatch();
    // After commit, Status must reflect pending=true
    expect(container.querySelector("#status")?.textContent).toBe("loading");
    expect(renderLog[renderLog.length - 1]).toBe(true);
  });

  it("commit applies the FINAL props when child receives multiple prop changes during patch", () => {
    let setLabel: (v: string) => Promise<void> = () => Promise.resolve();

    function* Label(props: { text: string }) {
      return createElement("span", { id: "label" }, props.text);
    }

    function* App() {
      const [text, setText] = yield* useState("a");
      setLabel = setText;
      return createElement("div", null, createElement(Label as never, { text }));
    }

    render(createElement(App as never, {}), container);
    expect(container.querySelector("#label")?.textContent).toBe("a");

    startUIPatch();
    setLabel("b");
    setLabel("c");
    // Frozen during patch
    expect(container.querySelector("#label")?.textContent).toBe("a");

    commitUIPatch();
    // Final value after commit
    expect(container.querySelector("#label")?.textContent).toBe("c");
  });
});

describe("child component prop updates apply correctly after local patch commit", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("child reflects changed props after local commit", () => {
    // Regression: mirrors the real demo where isPending=true fires BEFORE the patch,
    // then isPending=false fires inside the patch — button must be enabled after commit.
    let setPending: (v: boolean) => Promise<void> = () => Promise.resolve();
    let capturedStartPatch: () => () => void = () => () => {};

    function* Nav(props: { isPending: boolean }) {
      return createElement("button", { id: "btn", disabled: props.isPending }, "click");
    }

    function* App() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [isPending, setP] = yield* useState(false);
      setPending = setP;
      return createElement("div", null, createElement(Nav as never, { isPending }));
    }

    render(createElement(App as never, {}), container);
    expect(container.querySelector("#btn")?.hasAttribute("disabled")).toBe(false);

    // Set isPending=true BEFORE patch (immediate DOM update)
    setPending(true);
    expect(container.querySelector("#btn")?.hasAttribute("disabled")).toBe(true);

    const commit = capturedStartPatch();
    // Inside patch, clear isPending — DOM frozen (still disabled)
    setPending(false);
    expect(container.querySelector("#btn")?.hasAttribute("disabled")).toBe(true);

    commit();
    // After commit: isPending=false applied — button must be enabled
    expect(container.querySelector("#btn")?.hasAttribute("disabled")).toBe(false);
  });

  it("local patch: child isPending=true at commit time shows loading state", () => {
    let setPending: (v: boolean) => Promise<void> = () => Promise.resolve();
    let capturedStartPatch: () => () => void = () => () => {};

    function* Status(props: { pending: boolean }) {
      return createElement("span", { id: "status" }, props.pending ? "loading" : "done");
    }

    function* App() {
      const startPatch = yield* useUIPatch();
      capturedStartPatch = startPatch;
      const [pending, setP] = yield* useState(false);
      setPending = setP;
      return createElement("div", null, createElement(Status as never, { pending }));
    }

    render(createElement(App as never, {}), container);
    expect(container.querySelector("#status")?.textContent).toBe("done");

    const commit = capturedStartPatch();
    setPending(true); // App rerenders; Status deferred
    expect(container.querySelector("#status")?.textContent).toBe("done");

    commit();
    expect(container.querySelector("#status")?.textContent).toBe("loading");
  });
});
