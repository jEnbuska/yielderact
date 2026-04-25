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

import type { Context } from "../context";
import { resolveCtxValue } from "../context";
import { $CONTEXT, $EFFECT, $STATE } from "../hooks/descriptors";
import type { DependencyList } from "../hooks/types";
import { depsChanged } from "../hooks/utils";
import type { VNode, VNodeProps, VNodeType } from "../jsx";
import { propsWithChildren, shallowEqual } from "../prop-helpers";
import { Slot, SlotKey } from "../render/slots";
import type { ContextMap, HookState, RenderContext } from "../render/types";
import type { Component } from "../jsx";
import type { DomResult, OptionalUpdateResult, ReconcileResult } from "../reconciler/types";
import { MOUNT_REASON, PROPS_REASON } from "../render-reasons";
import { Defer } from "./defer-context";

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

export abstract class BaseInstance<TVNodeType extends VNodeType = VNodeType> {
  /** Time-slice deadline set by the scheduler. invokeUpdates yields when exceeded. */
  static sliceDeadline = Infinity;
  readonly contextKey?: Context;
  readonly vnode: VNode<TVNodeType>;
  readonly index: number;
  readonly depth: number;
  readonly parent: BaseInstance | null;
  /**
   * Live DOM container the instance's anchors sit in. Updated by
   * `buildComponent` / `buildContext` when an existing instance is reused
   * under a different element (e.g., the surrounding `<tr>` got rebuilt) —
   * its anchors physically migrate via `appendChildren`, and this field
   * has to follow so subsequent reconciles read the right parent.
   */
  parentDom: Node;
  protected pendingDomUpdates: DomResult[] = [];
  /**
   * ContextMap this instance exposes to its children and reads for its own
   * `context` hooks. ComponentInstance keeps the parent map unchanged;
   * ContextInstance extends it with its own handle before calling `super`.
   */
  readonly ctx: ContextMap;
  readonly rctx: RenderContext;
  readonly children: Map<string, BaseInstance> = new Map();
  readonly unmountedChildren: Set<BaseInstance> = new Set();
  slots: Slot[] = [];
  pendingSlots: Slot[] = [];
  keyIndex: Map<SlotKey, number> = new Map();
  pendingKeyIndex: Map<SlotKey, number> = new Map();
  hookStates: HookState[] = [];
  private props: VNodeProps;

  protected _unmounted = false;

  /** Saved generator from an interrupted deferred render. */
  private pendingGen: Generator<void, ReconcileResult & { domUpdates: DomResult[] }> | null = null;

  /** Active schedule reasons. Empty Set ⇒ instance is not in the queue. */
  protected renderReasons: Set<symbol> = new Set();

  protected resolveReasons: Set<symbol> = new Set();

  protected cleanupReasons: Set<symbol> = new Set();

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
    this.props = propsWithChildren(vnode);
    this.deps = vnode.props.deps;
    this.depth = (parent?.depth ?? -1) + 1;
    this.startAnchor = document.createComment(this.debugLabel());
  }

  debugLabel(): string {
    const { type } = this.vnode;
    if (typeof type === "string") return `<${type}>`;
    else if (typeof type === "function") return `<${type.name || "Component"}>`;
    return "<?>";
  }

  deferred() {
    return resolveCtxValue(this.ctx, Defer);
  }

  scheduleRender(reason: symbol, deferred?: boolean): void {
    // Always discard any in-flight saved generator so the next `apply()`
    // re-reads `this.props`. The scheduler dedupes queue entries via its
    // `members` set, so calling `scheduler.scheduleRender` repeatedly is
    // safe — but skipping the call here when `renderReasons.has(reason)`
    // would lose late prop updates: a setProps that fires while an apply
    // is mid-flight would update `this.props` but nothing would re-queue
    // the instance for a fresh render with the new props.
    this.pendingGen = null;
    this.renderReasons.add(reason);
    this.rctx.scheduler.scheduleRender(this, deferred);
  }

  unscheduleRender(reason: symbol, deferred?: boolean): void {
    if (this.renderReasons.delete(reason)) this.rctx.scheduler.unscheduleRender(this, deferred);
  }

  scheduleResolve(reason: symbol): void {
    if (this.resolveReasons.has(reason)) return;
    this.resolveReasons.add(reason);
    this.rctx.scheduler.scheduleResolve(this);
  }

  unscheduleResolve(reason: symbol): void {
    if (this.resolveReasons.delete(reason)) this.rctx.scheduler.unscheduleResolve(this);
  }

  scheduleEffect(reason: symbol): void {
    if (this.cleanupReasons.has(reason)) return;
    this.cleanupReasons.add(reason);
    this.rctx.scheduler.scheduleEffect(this);
  }

  /**
   * Template method: the scheduler calls this; the implementation in
   * `doRender()` is where concrete instances invoke their generator or
   * update their context handle. Reasons are cleared once `doRender()`
   * returns so a subsequent scheduling round starts from a clean slate.
   */
  *apply(): Generator<void, void, void> {
    if (this.isUnmounted()) return;
    const gen = this.pendingGen ?? this.invokeUpdates();
    this.pendingGen = gen;
    const result = yield* gen;
    this.pendingGen = null;
    this.renderReasons.clear();
    this.pendingSlots = result.slots;
    this.pendingKeyIndex = result.keyIndex;
    this.pendingDomUpdates = result.domUpdates;
  }

  private *invokeUpdates(): Generator<void, ReconcileResult & { domUpdates: DomResult[] }> {
    const generator = this.render(this.props);

    const domUpdates: Array<DomResult> = [];
    const toBeUnmounted = new Map(this.children);
    const pendingChildren: Map<string, BaseInstance> = new Map();
    const genNext = (value?: BaseInstance) => {
      return value !== undefined ? generator.next(value) : generator.next();
    };
    let result = genNext();
    while (!result.done) {
      if (Date.now() >= BaseInstance.sliceDeadline) yield;
      if (!result.value) {
        result = genNext();
        continue;
      }
      const next = result.value;
      if (next.type === "UPDATE_UI") {
        domUpdates.push(next);
        result = genNext();
        continue;
      }
      switch (next.type) {
        case "MOUNT": {
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
            const newInstance = createInstanceFn(
              path,
              vnode,
              this.ctx,
              index,
              this,
              this.rctx,
              parentDom,
            );
            pendingChildren.set(path, newInstance);
            result = genNext(newInstance);
          }
          break;
        }
        case "ENSURE_PROPS": {
          toBeUnmounted.delete(next.instance.childId);
          next.instance.setProps(next.vnode);
          next.instance.remount();
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
    for (const [path, instance] of pendingChildren) {
      this.children.set(path, instance);
      instance.scheduleRender(MOUNT_REASON);
    }
    for (const [_, removedInstance] of toBeUnmounted) removedInstance.unmount();
    return { ...result.value, domUpdates };
  }

  protected abstract render(
    props: Record<string, unknown>,
  ): Generator<OptionalUpdateResult, ReconcileResult, BaseInstance>;

  updateDOM(): void {
    if (this.isUnmounted()) return;
    try {
      for (const update of this.pendingDomUpdates) update.callback();
    } catch (e: any) {
      throw new Error(this.debugLabel(), { cause: e });
    } finally {
      this.pendingDomUpdates.length = 0;
    }
  }

  handleBatch = async <T>(callback: () => T): Promise<T> => {
    try {
      this.rctx.scheduler.beginBatch();
      return await callback();
    } finally {
      this.rctx.scheduler.endBatch();
    }
  };

  resolveStatePromises() {
    this.resolveReasons.clear();
    for (const state of this.hookStates) {
      if (state.type === $STATE) {
        state.pendingResolve?.();
        state.pendingResolve = undefined;
      }
    }
  }

  commit(): void {
    if (this._unmounted) return;
    this.slots = this.pendingSlots;
    this.keyIndex = this.pendingKeyIndex;
    for (const child of this.unmountedChildren) {
      child.runHookCleanupsLeafFirst();
      this.children.delete(child.childId);
    }
  }

  runEffects() {
    if (this._unmounted) return;
    for (const state of this.hookStates) {
      if (state.type === $EFFECT) {
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
      }
    }
    this.cleanupReasons.clear();
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
    // Drop any pending DOM ops — if `remount()` flips `_unmounted` back to
    // false without triggering a re-render, `updateDOM` must not fire ops
    // whose anchors may have been torn down or moved in the meantime.
    this.pendingDomUpdates.length = 0;
    this.parent?.unmountedChildren.add(this);
    const { scheduler } = this.rctx;
    if (this.renderReasons.size) scheduler.unscheduleRender(this);
    if (this.resolveReasons.size) scheduler.unscheduleResolve(this);
  }

  remount(): void {
    if (!this._unmounted) return;
    this._unmounted = false;
    this.parent?.unmountedChildren.delete(this);
    const { scheduler } = this.rctx;
    if (this.renderReasons.size) scheduler.scheduleRender(this);
    if (this.resolveReasons.size) scheduler.scheduleResolve(this);
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Abort effect controllers and unsubscribe from context handles,
   * recursing into children first so cleanup runs leaf-up.
   */
  private runHookCleanupsLeafFirst(): void {
    for (const [_, child] of this.children) {
      child._unmounted = true;
      child.runHookCleanupsLeafFirst();
    }
    for (const state of this.hookStates) {
      if (state === undefined) continue;
      if (state.type === $EFFECT) {
        state.controller?.abort();
      } else if (state.type === $CONTEXT) {
        state.unsubscribe?.();
      } else if (state.type === $STATE) {
        state.pendingResolve = undefined;
      }
    }
  }

  setProps(vnode: VNode): void {
    const deps = vnode.props.deps;
    if (!depsChanged(this.deps, deps)) return;
    this.deps = deps;
    const props = propsWithChildren(vnode);
    if (shallowEqual(this.props, props)) return;
    this.props = props;
    this.scheduleRender(PROPS_REASON);
  }
}
