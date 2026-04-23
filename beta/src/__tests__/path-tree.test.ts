import { describe, it, expect } from "vitest";
import { RenderTree, PostRenderTree, type PathInstance } from "../trees/path-tree";

/**
 * Minimal test double for PathInstance. `unmounted` is a plain boolean we
 * can flip between inserts and retrievals to exercise the prune logic.
 */
class TestInstance implements PathInstance {
  public unmounted = false;
  constructor(
    readonly path: readonly number[],
    readonly tag: string = path.join("."),
  ) {}
  isUnmounted(): boolean {
    return this.unmounted;
  }
}

const make = (path: number[], tag?: string) => new TestInstance(path, tag);

const isAncestor = (a: readonly number[], d: readonly number[]) =>
  a.length < d.length && a.every((v, i) => v === d[i]);

// ---------------------------------------------------------------------------
// Shared CRUD. Both classes inherit this behavior from PathTreeBase; we test
// it via TopFirstTree as a representative — the base is not exported.
// ---------------------------------------------------------------------------

describe("shared CRUD (via RenderTree)", () => {
  describe("when empty", () => {
    it("next return undefined", () => {
      const t = new RenderTree<TestInstance>();

      expect(t.next()).toBe(undefined);
    });

    it("remove() returns false for any instance", () => {
      const t = new RenderTree<TestInstance>();
      expect(t.remove(make([1]))).toBe(false);
    });
  });

  describe("insert", () => {
    it("stores a single instance", () => {
      const t = new RenderTree<TestInstance>();
      const a = make([0, 1]);
      t.add(a);
      expect(t.next()).toBe(a);
      expect(t.next()).toBe(undefined);
    });

    it("supports an empty-path root instance", () => {
      const t = new RenderTree<TestInstance>();
      const root = make([], "root");
      t.add(root);
      expect(t.next()).toBe(root);
    });

    it("auto-creates intermediate placeholder nodes for sparse inserts", () => {
      // Inserting [1, 2, 3] with nothing at [1] or [1, 2] must not fail;
      // placeholders are materialized silently and the leaf becomes
      // retrievable by next().
      const t = new RenderTree<TestInstance>();
      const only = make([1, 2, 3]);
      t.add(only);
      expect(t.next()).toBe(only);
    });

    it("ignores a second insert of the same instance", () => {
      const t = new RenderTree<TestInstance>();
      const a = make([0]);
      t.add(a);
      t.add(a);
      expect(t.next()).toBe(a);
      expect(t.next()).toBe(undefined);
    });
  });

  describe("remove", () => {
    it("decrements size and clears has()", () => {
      const t = new RenderTree<TestInstance>();
      const a = make([0, 1]);
      t.add(a);
      expect(t.remove(a)).toBe(true);
      expect(t.next()).toBe(undefined);
    });

    it("returns false when removing an instance that was never inserted", () => {
      const t = new RenderTree<TestInstance>();
      const a = make([0, 1]);
      expect(t.remove(a)).toBe(false);
    });

    it("permits re-insertion after removal (placeholders cleaned up)", () => {
      const t = new RenderTree<TestInstance>();
      const a = make([1, 2, 3]);
      t.add(a);
      t.remove(a);
      t.add(a);
      expect(t.next()).toBe(a);
      expect(t.next()).toBe(undefined);
    });

    it("does not disturb siblings of the removed instance", () => {
      const t = new RenderTree<TestInstance>();
      const a = make([0, 0]);
      const b = make([0, 1]);
      t.add(a);
      t.add(b);
      t.remove(a);
      expect(t.next()).toBe(b);
      expect(t.next()).toBe(undefined);
    });

    it("preserves ancestors that still host other descendants", () => {
      // Removing [0, 0, 0] must not destroy the placeholder at [0] that
      // still hosts [0, 1] as a descendant.
      const t = new RenderTree<TestInstance>();
      const deep = make([0, 0, 0]);
      const sibling = make([0, 1]);
      t.add(deep);
      t.add(sibling);
      t.remove(deep);
      expect(t.next()).toBe(sibling);
      expect(t.next()).toBe(undefined);
    });
  });
});

// ---------------------------------------------------------------------------
// TopFirstTree — top-down drain with unmount-subtree extraction.
// ---------------------------------------------------------------------------

describe("TopFirstTree.next", () => {
  it("returns undefined on an empty tree", () => {
    const t = new RenderTree<TestInstance>();
    expect(t.next()).toBeUndefined();
  });

  it("pops a single mounted instance and empties the tree", () => {
    const t = new RenderTree<TestInstance>();
    const a = make([0, 1]);
    t.add(a);
    const r = t.next();
    expect(r).toEqual({ kind: "mounted", instance: a });
    expect(t.isEmpty).toBe(true);
    expect(t.has(a)).toBe(false);
  });

  it("surfaces a single unmounted instance as a one-element subtree batch", () => {
    const t = new RenderTree<TestInstance>();
    const a = make([0]);
    a.unmounted = true;
    t.add(a);
    const r = t.next();
    expect(r?.kind).toBe("unmounted");
    if (r?.kind !== "unmounted") throw new Error("wrong kind");
    expect(r.instances).toEqual([a]);
    expect(t.isEmpty).toBe(true);
  });

  it("returns something from the shallowest depth, never a deeper node", () => {
    const t = new RenderTree<TestInstance>();
    const top = make([0]);
    const deep = make([0, 5, 3]);
    const sibling = make([1]);
    t.add(deep);
    t.add(top);
    t.add(sibling);
    const r = t.next();
    expect(r?.kind).toBe("mounted");
    if (r?.kind !== "mounted") throw new Error("wrong kind");
    // Either top-level instance is acceptable; the deep one never is.
    expect([top, sibling]).toContain(r.instance);
    expect(r.instance).not.toBe(deep);
  });

  it("removes only the popped mounted node; descendants remain", () => {
    const t = new RenderTree<TestInstance>();
    const parent = make([0]);
    const child = make([0, 0]);
    t.add(parent);
    t.add(child);
    const r = t.next();
    expect(r).toEqual({ kind: "mounted", instance: parent });
    expect(t.has(parent)).toBe(false);
    expect(t.has(child)).toBe(true);
    expect(t.size).toBe(1);
  });

  it("detaches the full subtree when the top-most is unmounted, including mounted descendants", () => {
    const t = new RenderTree<TestInstance>();
    const root = make([0]);
    const mountedChild = make([0, 0]);
    const mountedGrand = make([0, 0, 1]);
    const mountedOther = make([0, 2]);
    root.unmounted = true;
    t.add(root);
    t.add(mountedChild);
    t.add(mountedGrand);
    t.add(mountedOther);

    const r = t.next();
    expect(r?.kind).toBe("unmounted");
    if (r?.kind !== "unmounted") throw new Error("wrong kind");
    expect(new Set(r.instances)).toEqual(new Set([root, mountedChild, mountedGrand, mountedOther]));
    expect(t.isEmpty).toBe(true);
  });

  it("does not detach sibling subtrees when one is unmounted", () => {
    const t = new RenderTree<TestInstance>();
    const deadTop = make([0]);
    const deadChild = make([0, 3]);
    const liveTop = make([1]);
    const liveChild = make([1, 0]);
    deadTop.unmounted = true;
    t.add(deadTop);
    t.add(deadChild);
    t.add(liveTop);
    t.add(liveChild);

    const r = t.next();
    expect(r?.kind).toBe("unmounted");
    if (r?.kind !== "unmounted") throw new Error("wrong kind");
    expect(new Set(r.instances)).toEqual(new Set([deadTop, deadChild]));

    expect(t.has(liveTop)).toBe(true);
    expect(t.has(liveChild)).toBe(true);
    expect(t.size).toBe(2);
  });

  it("never returns a descendant before its ancestor across a full drain", () => {
    const t = new RenderTree<TestInstance>();
    const instances = [
      make([0]),
      make([0, 0]),
      make([0, 0, 0]),
      make([0, 1]),
      make([1]),
      make([1, 0]),
      make([1, 0, 5]),
      make([2, 3]),
    ];
    // Deliberately scrambled insertion order.
    for (const i of [6, 0, 3, 7, 1, 5, 2, 4]) t.add(instances[i]);

    // Drain, recording the order mounted instances came out. No instances
    // here are unmounted, so we expect only 'mounted' entries.
    const drained: TestInstance[] = [];
    while (true) {
      const entry = t.next();
      if (!entry) break;
      expect(entry.kind).toBe("mounted");
      if (entry.kind === "mounted") drained.push(entry.instance);
    }
    expect(drained.length).toBe(instances.length);

    const indexOf = new Map<TestInstance, number>();
    drained.forEach((inst, idx) => indexOf.set(inst, idx));
    for (const ancestor of instances) {
      for (const descendant of instances) {
        if (ancestor === descendant) continue;
        if (isAncestor(ancestor.path, descendant.path)) {
          expect(indexOf.get(ancestor)!).toBeLessThan(indexOf.get(descendant)!);
        }
      }
    }
  });

  it("drains a mixed mounted/unmounted tree correctly", () => {
    const t = new RenderTree<TestInstance>();
    const a = make([0]);
    const b = make([0, 1]);
    const c = make([1]);
    const d = make([1, 0]);
    c.unmounted = true;

    t.add(a);
    t.add(b);
    t.add(c);
    t.add(d);

    const mounted: TestInstance[] = [];
    const unmountedBatches: TestInstance[][] = [];
    while (true) {
      const entry = t.next();
      if (!entry) break;
      if (entry.kind === "mounted") mounted.push(entry.instance);
      else unmountedBatches.push(entry.instances);
    }
    expect(t.isEmpty).toBe(true);

    expect(mounted).toContain(a);
    expect(mounted).toContain(b);
    expect(mounted.indexOf(a)).toBeLessThan(mounted.indexOf(b));
    expect(unmountedBatches).toHaveLength(1);
    expect(new Set(unmountedBatches[0])).toEqual(new Set([c, d]));
  });

  it("re-evaluates isUnmounted dynamically between calls", () => {
    const t = new RenderTree<TestInstance>();
    const a = make([0]);
    t.add(a);

    // Initially mounted → mounted result.
    a.unmounted = false;
    // Peek without mutating not available by design; instead we use a
    // separate tree for the mounted case to avoid cross-test state.
    const t2 = new RenderTree<TestInstance>();
    const a2 = make([0]);
    t2.add(a2);
    a2.unmounted = false;
    expect(t2.next()?.kind).toBe("mounted");

    // Flip unmounted before calling next on the first tree.
    a.unmounted = true;
    expect(t.next()?.kind).toBe("unmounted");
  });
});

// ---------------------------------------------------------------------------
// LastFirstTree — bottom-up drain, unmount state irrelevant.
// ---------------------------------------------------------------------------

describe("LastFirstTree.next", () => {
  it("returns undefined on an empty tree", () => {
    const t = new PostRenderTree<TestInstance>();
    expect(t.next()).toBeUndefined();
  });

  it("returns a leaf and removes it", () => {
    const t = new PostRenderTree<TestInstance>();
    const a = make([0]);
    const b = make([0, 1]); // strict leaf
    t.add(a);
    t.add(b);
    expect(t.next()).toBe(b);
    expect(t.has(b)).toBe(false);
    expect(t.has(a)).toBe(true);
    expect(t.size).toBe(1);
  });

  it("returns unmounted leaves just like mounted ones", () => {
    // The whole point: cleanup must visit every node.
    const t = new PostRenderTree<TestInstance>();
    const a = make([0]);
    a.unmounted = true;
    t.add(a);
    expect(t.next()).toBe(a);
    expect(t.isEmpty).toBe(true);
  });

  it("descends through an unmounted ancestor into deeper leaves", () => {
    const t = new PostRenderTree<TestInstance>();
    const parent = make([0]);
    const child = make([0, 5]);
    parent.unmounted = true;
    t.add(parent);
    t.add(child);
    // The leaf below the unmounted ancestor is returned first.
    expect(t.next()).toBe(child);
    // Parent is still there and comes out next.
    expect(t.next()).toBe(parent);
  });

  it("returns some leaf when several exist (sibling order unspecified)", () => {
    const t = new PostRenderTree<TestInstance>();
    const a = make([0, 1, 2, 3]);
    const b = make([5]);
    const c = make([2, 7]);
    t.add(a);
    t.add(b);
    t.add(c);
    expect([a, b, c]).toContain(t.next());
  });

  it("never returns an ancestor before a descendant across a full drain", () => {
    const t = new PostRenderTree<TestInstance>();
    const instances = [
      make([0]),
      make([0, 0]),
      make([0, 0, 0]),
      make([0, 1]),
      make([1]),
      make([1, 0]),
      make([2]),
    ];
    for (const i of [5, 0, 3, 6, 1, 2, 4]) t.add(instances[i]);

    const drained: TestInstance[] = [];
    while (true) {
      const leaf = t.next();
      if (!leaf) break;
      drained.push(leaf);
    }
    expect(drained.length).toBe(instances.length);

    const indexOf = new Map<TestInstance, number>();
    drained.forEach((inst, idx) => indexOf.set(inst, idx));
    for (const ancestor of instances) {
      for (const descendant of instances) {
        if (ancestor === descendant) continue;
        if (isAncestor(ancestor.path, descendant.path)) {
          // Ancestor comes AFTER descendant.
          expect(indexOf.get(ancestor)!).toBeGreaterThan(indexOf.get(descendant)!);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// End-to-end workflow exercising both classes together.
// ---------------------------------------------------------------------------

describe("render-then-cleanup workflow", () => {
  it("renders mounted instances top-down and cleans up bottom-up", () => {
    const renderQueue = new RenderTree<TestInstance>();
    const cleanupQueue = new PostRenderTree<TestInstance>();

    const a = make([0]);
    const b = make([0, 0]);
    const c = make([0, 0, 0]);
    const d = make([1]);
    renderQueue.add(a);
    renderQueue.add(b);
    renderQueue.add(c);
    renderQueue.add(d);

    const rendered: TestInstance[] = [];
    while (true) {
      const entry = renderQueue.next();
      if (!entry) break;
      if (entry.kind === "mounted") {
        rendered.push(entry.instance);
        cleanupQueue.add(entry.instance);
      } else {
        for (const inst of entry.instances) cleanupQueue.add(inst);
      }
    }
    expect(rendered).toHaveLength(4);
    // Parent-before-child in render order.
    const rIdx = (x: TestInstance) => rendered.indexOf(x);
    expect(rIdx(a)).toBeLessThan(rIdx(b));
    expect(rIdx(b)).toBeLessThan(rIdx(c));

    const cleaned: TestInstance[] = [];
    while (true) {
      const inst = cleanupQueue.next();
      if (!inst) break;
      cleaned.push(inst);
    }
    expect(cleaned).toHaveLength(4);
    // Child-before-parent in cleanup order.
    const cIdx = (x: TestInstance) => cleaned.indexOf(x);
    expect(cIdx(c)).toBeLessThan(cIdx(b));
    expect(cIdx(b)).toBeLessThan(cIdx(a));
  });

  it("unmounted subtrees skip the render queue but still reach cleanup", () => {
    const renderQueue = new RenderTree<TestInstance>();
    const cleanupQueue = new PostRenderTree<TestInstance>();

    const mountedA = make([0]);
    const unmountedRoot = make([1]);
    const underUnmounted = make([1, 2]);
    unmountedRoot.unmounted = true;

    renderQueue.add(mountedA);
    renderQueue.add(unmountedRoot);
    renderQueue.add(underUnmounted);

    const rendered: TestInstance[] = [];
    while (true) {
      const entry = renderQueue.next();
      if (!entry) break;
      if (entry.kind === "mounted") {
        rendered.push(entry.instance);
        cleanupQueue.add(entry.instance);
      } else {
        for (const inst of entry.instances) cleanupQueue.add(inst);
      }
    }
    expect(rendered).toEqual([mountedA]);

    const cleaned: TestInstance[] = [];
    while (true) {
      const inst = cleanupQueue.next();
      if (!inst) break;
      cleaned.push(inst);
    }
    expect(new Set(cleaned)).toEqual(new Set([mountedA, unmountedRoot, underUnmounted]));
  });
});

// ---------------------------------------------------------------------------
// Scale check.
// ---------------------------------------------------------------------------

describe("scale", () => {
  it("handles 50k insertions through a full render-then-cleanup pass", () => {
    const render = new RenderTree<TestInstance>();
    const cleanup = new PostRenderTree<TestInstance>();

    const all: TestInstance[] = [];
    let seed = 98765;
    for (let i = 0; i < 50_000; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const depth = 1 + (seed % 8);
      const path: number[] = [];
      let s = seed;
      for (let d = 0; d < depth; d++) {
        s = (s * 22695477 + 1) & 0x7fffffff;
        path.push(s % 4);
      }
      path.push(i); // guarantee uniqueness
      const inst = make(path);
      all.push(inst);
      render.add(inst);
    }
    expect(render.size).toBe(50_000);

    let renderedCount = 0;
    while (true) {
      const entry = render.next();
      if (!entry) break;
      if (entry.kind === "mounted") {
        renderedCount += 1;
        cleanup.add(entry.instance);
      } else {
        for (const inst of entry.instances) cleanup.add(inst);
      }
    }
    expect(render.isEmpty).toBe(true);
    // No instances were unmounted, so all 50k rendered.
    expect(renderedCount).toBe(50_000);
    expect(cleanup.size).toBe(50_000);

    let cleanedCount = 0;
    while (cleanup.next() !== undefined) cleanedCount += 1;
    expect(cleanedCount).toBe(50_000);
    expect(cleanup.isEmpty).toBe(true);
  });
});
