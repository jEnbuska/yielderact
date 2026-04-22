/**
 * BaseInstance — shared lifecycle for ComponentInstance and ContextInstance.
 *
 * Each instance represents one mounted component or context provider in the
 * render tree. Every instance receives its parent's ContextMap as the `ctx`
 * constructor argument. Component instances simply store it; context
 * instances extend it with their own handle before calling `super`.
 *
 * Render scheduling is reason-based: callers pass an optional `reason`
 * symbol to `scheduleApply`. The instance only actually leaves the
 * scheduler queue when all of its render reasons have been cleared — either
 * by `unscheduleApply(reason)` (e.g. a context subscriber deciding the
 * change was irrelevant) or by the render actually executing. The scheduler
 * itself doesn't know about reasons; it just sees `schedule` / `unschedule`.
 *
 * Cleanup is split into small helpers so `unmount()` reads as a sequence of
 * responsibilities rather than one long block.
 */

import type { Context, ContextHandle } from "../context";
import { resolveCtxValue } from "../context";
import { $CONTEXT, $EFFECT, $STATE } from "../hooks/descriptors";
import type { DependencyList } from "../hooks/types";
import { depsChanged } from "../hooks/utils";
import type { VNode, VNodeProps, VNodeType } from "../jsx";
import { propsWithChildren, shallowEqual } from "../prop-helpers";
import type { Slot, SlotKey } from "../render/slots";
import type { ContextMap, HookState, RenderContext } from "../render/types";
import type { Component } from "../jsx";
import type { DomResult, OptionalUpdateResult, ReconcileResult } from "../reconciler/types";
import { MOUNT_REASON, PROPS_REASON } from "../render-reasons";
import { Deferred } from "./deferred-context";

type CreateInstanceFn = <T extends Context | Component>(
  childId: string,
  vnode: VNode<T>,
  parentCtx: ContextMap,
  index: number,
  parent: BaseInstance | null,
  rctx: RenderContext,
  parentDom: Node,
) => BaseInstance<T>;

let createInstanceFn: CreateInstanceFn;

export function registerCreateInstance(fn: CreateInstanceFn): void {
  createInstanceFn = fn;
}

// ── Profiling counters (remove after profiling) ─────────────────────
export const perf = {
  renderTime: 0,
  jsonStringifyTime: 0,
  createInstanceTime: 0,
  scheduleChildrenTime: 0,
  dateNowCalls: 0,
  mountCount: 0,
  reconcileCount: 0,
  // Reconciler breakdown
  reconcileAllocTime: 0,
  buildSlotTime: 0,
  buildElementTime: 0,
  pass3Time: 0,
  slotPathAllocTime: 0,
  generatorNextTime: 0,
  generatorNextCalls: 0,
  reset() {
    this.renderTime = this.jsonStringifyTime = 0;
    this.createInstanceTime = this.scheduleChildrenTime = 0;
    this.dateNowCalls = this.mountCount = this.reconcileCount = 0;
    this.reconcileAllocTime = this.buildSlotTime = this.buildElementTime = 0;
    this.pass3Time = this.slotPathAllocTime = 0;
    this.generatorNextTime = this.generatorNextCalls = 0;
  },
  dump() {
    console.log(`[perf] render: ${this.renderTime.toFixed(1)}ms (component generators)`);
    console.log(
      `[perf] JSON.stringify: ${this.jsonStringifyTime.toFixed(1)}ms (${this.mountCount} MOUNTs)`,
    );
    console.log(`[perf] createInstance: ${this.createInstanceTime.toFixed(1)}ms`);
    console.log(`[perf] scheduleChildren: ${this.scheduleChildrenTime.toFixed(1)}ms`);
    console.log(
      `[perf] reconcile allocs: ${this.reconcileAllocTime.toFixed(1)}ms (${this.reconcileCount} calls)`,
    );
    console.log(`[perf] buildSlot: ${this.buildSlotTime.toFixed(1)}ms`);
    console.log(`[perf] buildElement: ${this.buildElementTime.toFixed(1)}ms`);
    console.log(`[perf] pass3 positioning: ${this.pass3Time.toFixed(1)}ms`);
    console.log(`[perf] slotPath alloc: ${this.slotPathAllocTime.toFixed(1)}ms`);
    console.log(
      `[perf] generator.next: ${this.generatorNextTime.toFixed(1)}ms (${this.generatorNextCalls} calls)`,
    );
    console.log(`[perf] Date.now calls: ${this.dateNowCalls}`);
  },
};

export abstract class BaseInstance<TVNodeType extends VNodeType = VNodeType> {
  /** Time-slice deadline set by the scheduler. invokeUpdates yields when exceeded. */
  static sliceDeadline = Infinity;
  readonly contextKey?: Context;
  readonly vnode: VNode<TVNodeType>;
  readonly index: number;
  readonly path: readonly number[];
  readonly parent: BaseInstance | null;
  readonly parentDom: Node;
  protected pendingDomUpdates: Iterable<DomResult> = [];
  private initialMount = true;
  /**
   * ContextMap this instance exposes to its children and reads for its own
   * `context` hooks. ComponentInstance keeps the parent map unchanged;
   * ContextInstance extends it with its own handle before calling `super`.
   */
  readonly ctx: ContextMap;
  readonly rctx: RenderContext;
  readonly children: Map<string, BaseInstance> = new Map();
  readonly keysByInstance: Map<BaseInstance, string> = new Map();
  readonly unmountedChildren: Set<BaseInstance> = new Set();
  slots: Slot[] = [];
  pendingSlots: Slot[] = [];
  keyIndex: Map<SlotKey, number> = new Map();
  pendingKeyIndex: Map<SlotKey, number> = new Map();
  hookStates: HookState[] = [];
  props?: VNodeProps;
  nextProps: VNodeProps;
  committedProps: VNodeProps;

  protected _unmounted = false;

  /** Saved generator from an interrupted deferred render. */
  private pendingGen: Generator<void, ReconcileResult & { domUpdates: DomResult[] }> | null = null;

  /** Active schedule reasons. Empty Set ⇒ instance is not in the queue. */
  protected renderReasons: Set<symbol> = new Set();

  /**
   * DOM anchor pair delimiting this instance's subtree. Everything between
   * `startAnchor.nextSibling` and `endAnchor` belongs to this instance.
   * The reconciler moves/inserts/removes the instance by walking this range.
   */
  startAnchor: Comment;
  readonly endAnchor: Comment = document.createComment("/");

  /**
   * Dependency array for reconciliation memoization, set from the `deps`
   * framework prop.
   *
   * When present, replaces the default `shallowEqual` props check in
   * `setProps` with a `depsChanged()` comparison — the same mechanism
   * used by hooks. The component only rerenders when at least one element
   * in the array changes (via `Object.is`).
   *
   * Useful when a parent passes new object references but the component
   * only cares about a subset of values:
   *
   * ```tsx
   * <Expensive deps={[items.length, filter]} data={items} filter={filter} />
   * ```
   */
  deps?: DependencyList | undefined;

  get [Symbol.toStringTag]() {
    return this.debugLabel();
  }

  childId: string;

  constructor(
    childId: string,
    vnode: VNode<TVNodeType>,
    ctx: ContextMap,
    index: number,
    parent: BaseInstance | null,
    rctx: RenderContext,
    parentDom: Node,
  ) {
    this.childId = childId;
    this.vnode = vnode;
    this.index = index;
    this.parent = parent;
    this.ctx = ctx;
    this.parentDom = parentDom;
    this.rctx = rctx;
    // Strip framework directives (key, shown) and merge positional children
    // into children. Uses the same `propsWithChildren` that the reconciler's
    // `setProps` path uses, so initial and updated props have the same shape.
    this.committedProps = this.nextProps = propsWithChildren(vnode);
    this.deps = vnode.props.deps;
    this.path = parent ? [...parent.path, index] : [index];
    this.startAnchor = document.createComment(this.debugLabel());
  }

  debugLabel(): string {
    const { type } = this.vnode;
    if (typeof type === "string") return `<${type}>`;
    else if (typeof type === "function") return `<${type.name || "Component"}>`;
    return "<?>";
  }

  isDeferred() {
    return resolveCtxValue(this.ctx, Deferred);
  }

  /**xt
   * Enqueue a render under the given reason. If no reason is passed a
   * default symbol is used — callers that want per-source bookkeeping
   * (e.g. context subscribers) should pass their own reason.
   */
  scheduleApply(reason: symbol = PROPS_REASON): void {
    this.renderReasons.add(reason);
    this.pendingGen = null;
    this.rctx.scheduler.schedule(this);
  }

  /**
   * Drop a render reason. If no reasons remain the instance is removed
   * from the scheduler queue. Used by context subscribers that decided
   * the value change was not relevant to their selector.
   */
  unscheduleApply(reason = PROPS_REASON): void {
    if (!this.renderReasons.delete(reason)) return;
    if (this.renderReasons.size === 0) {
      this.rctx.scheduler.unschedule(this);
    }
  }

  /**
   * Template method: the scheduler calls this; the implementation in
   * `doRender()` is where concrete instances invoke their generator or
   * update their context handle. Reasons are cleared once `doRender()`
   * returns so a subsequent scheduling round starts from a clean slate.
   */
  *apply(): Generator<void, ReconcileResult & { domUpdates: DomResult[] }> {
    if (this.isUnmounted()) return { slots: [], keyIndex: new Map(), domUpdates: [] };
    const gen = this.pendingGen ?? this.invokeUpdates();
    this.pendingGen = gen;
    const result = yield* gen;
    this.pendingGen = null;
    return result;
  }

  private *invokeUpdates(): Generator<void, ReconcileResult & { domUpdates: DomResult[] }> {
    let t0 = performance.now();
    const generator = this.render(this.nextProps);
    perf.renderTime += performance.now() - t0;

    const domUpdates: Array<DomResult> = [];
    const toBeUnmounted = new Map(this.children);
    const pendingChildren: Array<{ path: string; instance: BaseInstance }> = [];
    const genNext = (value?: BaseInstance) => {
      perf.generatorNextCalls++;
      const t = performance.now();
      const r = value !== undefined ? generator.next(value) : generator.next();
      perf.generatorNextTime += performance.now() - t;
      return r;
    };
    let result = genNext();
    while (!result.done) {
      perf.dateNowCalls++;
      if (Date.now() >= BaseInstance.sliceDeadline) yield;
      if (!result.value) {
        result = genNext();
        continue;
      }
      const next = result.value;
      if (next.type === "DOM") {
        domUpdates.push(next);
        result = genNext();
        continue;
      }
      switch (next.type) {
        case "MOUNT": {
          perf.mountCount++;
          const { vnode, index, parentDom } = next;
          const path = next.slotPath;
          const instance = this.children.get(path);
          toBeUnmounted.delete(path);
          if (vnode.type === instance?.vnode.type) {
            instance.remount();
            instance.setProps(vnode);
            result = genNext(instance);
          } else {
            instance?.unmount();
            t0 = performance.now();
            const newInstance = createInstanceFn(
              path,
              vnode,
              this.ctx,
              index,
              this,
              this.rctx,
              parentDom,
            );
            perf.createInstanceTime += performance.now() - t0;
            pendingChildren.push({ path, instance: newInstance });
            result = genNext(newInstance);
          }
          break;
        }
        case "SET_PROPS": {
          toBeUnmounted.delete(this.keysByInstance.get(next.instance)!);
          next.instance.setProps(next.vnode);
          result = genNext();
          break;
        }
        case "UNMOUNT": {
          next.instance.unmount();
          result = genNext();
          break;
        }
      }
    }
    const t1 = performance.now();
    for (const { path, instance } of pendingChildren) {
      this.children.set(path, instance);
      this.keysByInstance.set(instance, path);
      instance.scheduleApply(MOUNT_REASON);
    }
    perf.scheduleChildrenTime += performance.now() - t1;
    for (const [_, removedInstance] of toBeUnmounted) removedInstance.unmount();
    return { ...result.value, domUpdates };
  }

  commitApply(result: ReconcileResult & { domUpdates: DomResult[] }): void {
    this.renderReasons.clear();
    const { slots, keyIndex, domUpdates } = result;
    this.props = this.nextProps;
    this.pendingSlots = slots;
    this.pendingKeyIndex = keyIndex;
    this.pendingDomUpdates = domUpdates;
  }

  protected abstract render(
    props: Record<string, unknown>,
  ): Generator<OptionalUpdateResult, ReconcileResult, BaseInstance>;

  applyDomUpdates(): void {
    if (this.isUnmounted()) {
      this.pendingDomUpdates = [];
      return;
    }
    for (const update of this.pendingDomUpdates) {
      update.callback();
    }
    this.initialMount = false;
    this.pendingDomUpdates = [];
  }

  handleBatch = async <T>(callback: () => T): Promise<T> => {
    try {
      this.rctx.scheduler.beginBatch();
      return await callback();
    } finally {
      this.rctx.scheduler.endBatch();
    }
  };

  afterAllApplied(): void {
    if (this.isUnmounted()) return;
    this.slots = this.pendingSlots;
    this.keyIndex = this.pendingKeyIndex;
    this.committedProps = this.props!;
    for (const child of this.unmountedChildren) {
      child.runHookCleanupsLeafFirst();
      this.children.delete(child.childId);
      this.keysByInstance.delete(child);
      this.unmountedChildren.delete(child);
    }
    for (const state of this.hookStates) {
      if (state === undefined) continue;
      if (state.type === $STATE) {
        state.pendingResolve?.();
        state.pendingResolve = undefined;
      } else if (state.type === $EFFECT) {
        if (!state.controller) {
          // First run.
          const controller = new AbortController();
          state.controller = controller;
          void state.fn(controller.signal);
        } else if (state.dirty) {
          // Deps changed — abort the previous run, start fresh.
          state.controller.abort();
          const controller = new AbortController();
          state.controller = controller;
          state.dirty = false;
          void state.fn(controller.signal);
        }
      } else if (state.type === $CONTEXT) {
        if (state.unsubscribe) continue;
        const handle = this.ctx.get(state.ctx) as ContextHandle | undefined;
        if (!handle) continue;
        state.unsubscribe = handle.subscribe(() => {
          if (this.isUnmounted()) return;
          const current = state.depsSelector(handle.ref.current);
          state.currentSelected = current;
          if (!depsChanged(state.lastRenderedDepsSelected, current)) {
            this.unscheduleApply(state.reason);
            return;
          }
          this.scheduleApply(state.reason);
        });
      }
    }
  }

  isUnmounted(): boolean {
    if (this._unmounted) {
      return true;
    }
    let { parent } = this;
    while (parent) {
      if (parent._unmounted) return true;
      parent = parent.parent;
    }
    return false;
  }

  /**
   * Mark this instance unmounted and schedule it. The scheduler then
   * calls `render()`, whose unmount branch drives `unmountSlot` on each
   * owned slot — partitioning DOM/COMPONENT callbacks the same way
   * `doRender` does — and queues a `removeRange` of this instance's own
   * anchors into `domUpdates`. Hook cleanups still run from the parent's
   * `afterRender` leaf-first.
   */
  unmount(): void {
    if (this._unmounted) return;
    this._unmounted = true;
    this.pendingGen = null;
    if (!this.parent) return;
    this.rctx.scheduler.unschedule(this);
    this.parent.unmountedChildren.add(this);
  }

  remount(): void {
    if (!this._unmounted) return;
    this._unmounted = false;
    if (!this.parent) return;
    this.rctx.scheduler.schedule(this);
    this.parent.unmountedChildren.delete(this);
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Abort effect controllers and unsubscribe from context handles,
   * recursing into children first so cleanup runs leaf-up.
   */
  private runHookCleanupsLeafFirst(): void {
    for (const [_, child] of this.children) {
      child.runHookCleanupsLeafFirst();
    }
    for (const state of this.hookStates) {
      if (state === undefined) continue;
      if (state.type === $EFFECT) {
        state.controller?.abort();
      } else if (state.type === $CONTEXT) {
        state.unsubscribe?.();
      }
    }
  }

  setProps(vnode: VNode): void {
    const deps = vnode.props.deps;
    if (!depsChanged(this.deps, deps)) return;
    this.deps = deps;
    const props = propsWithChildren(vnode);
    if (shallowEqual(this.nextProps, props)) return;
    this.nextProps = props;
    this.scheduleApply();
  }
}
