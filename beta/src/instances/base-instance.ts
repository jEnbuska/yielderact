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
 * Lazy collections: `_children`, `_unmountedChildren`, `_hookStates`,
 * `_renderReasons`, `_resolveReasons`, `_effectReasons` are all
 * null-initialized and allocated only on first write. Saves several
 * hundred bytes per leaf instance (no Map/Set/Array allocation at construct
 * time). Read sites use `this._field?.method(...)` / `this._field ?? []`;
 * write sites go through the `??= new ...()` pattern.
 */

import type { Context } from "../context";
import { resolveCtxValue } from "../context";
import { $CONTEXT, $EFFECT, $STATE } from "../hooks/descriptors";
import type { DependencyList } from "../hooks/types";
import { depsChanged } from "../hooks/utils";
import type { VNode, VNodeProps, VNodeType, IterableChild } from "../jsx";
import { propsWithChildren, shallowEqual } from "../prop-helpers";
import { Slot, SlotKey } from "../render/slots";
import type { ContextMap, HookState, RenderContext } from "../render/types";
import type { Component } from "../jsx";
import type { DomResult, OptionalUpdateResult, ReconcileResult } from "../reconciler/types";
import { reconcile, build } from "../reconciler/reconciler";
import { MOUNT_REASON, PROPS_REASON } from "../render-reasons";
import { Defer } from "./defer-context";

type CreateInstanceFn = <T extends Context | Component>(
  childId: string,
  vnode: VNode<T>,
  parentCtx: ContextMap,
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
  protected _unmounted?: boolean;
  readonly contextKey?: Context;
  readonly vnode: VNode<TVNodeType>;
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

  // Lazy collections — null until first write. Saves allocations on leaf
  // instances that never accumulate children, scheduling reasons, or hooks.

  private _children?: Map<string, BaseInstance>;
  private _unmountedChildren?: Set<BaseInstance>;
  private _hookStates?: HookState[];
  private _renderReasons?: Set<symbol>;
  private _resolveReasons?: Set<symbol>;
  private _effectReasons?: Set<symbol>;

  // Slot tree state — undefined until first apply assigns. Reconcile's
  // default params accept undefined, so subclasses can pass these through
  // without a fallback.
  slots?: Slot[];
  pendingSlots?: Slot[];
  keyIndex?: Map<SlotKey, number>;
  pendingKeyIndex?: Map<SlotKey, number>;
  private props: VNodeProps;

  /** Saved generator from an interrupted deferred render. */
  private pendingGen?: Generator<
    void,
    ReconcileResult & {
      domUpdates: DomResult[];
      unmountedChildren: Set<BaseInstance>;
      nextChildren: Map<string, BaseInstance>;
    }
  >;

  /**
   * DOM anchor pair delimiting this instance's subtree. Everything between
   * `startAnchor.nextSibling` and `endAnchor` belongs to this instance.
   * The reconciler moves/inserts/removes the instance by walking this range.
   */
  startAnchor: Comment;
  readonly endAnchor: Comment = document.createComment("/");

  /**
   * Dependency array for reconciliation memoization, set from the `deps`
   * framework prop. When present, replaces the default `shallowEqual` props
   * check in `setProps` with a `depsChanged()` comparison.
   */
  deps?: DependencyList;

  get [Symbol.toStringTag]() {
    return this.debugLabel();
  }

  childId: string;

  constructor(
    childId: string,
    vnode: VNode<TVNodeType>,
    ctx: ContextMap,
    parent: BaseInstance | null,
    rctx: RenderContext,
    parentDom: Node,
  ) {
    this.childId = childId;
    this.vnode = vnode;
    this.parent = parent;
    this.ctx = ctx;
    this.parentDom = parentDom;
    this.rctx = rctx;
    this.props = propsWithChildren(vnode);
    this.deps = vnode.props.deps;
    this.depth = (parent?.depth ?? -1) + 1;
    this.startAnchor = document.createComment(this.debugLabel());
  }

  // ── Lazy-collection accessors (public, for hooks/utils + subclasses) ────
  get hookStates(): HookState[] {
    return (this._hookStates ??= []);
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
    this.pendingGen = undefined;
    (this._renderReasons ??= new Set()).add(reason);
    this.rctx.scheduler.scheduleRender(this, deferred);
  }

  unscheduleRender(reason: symbol, deferred?: boolean): void {
    if (this._renderReasons?.delete(reason)) {
      this.rctx.scheduler.unscheduleRender(this, deferred);
    }
  }

  scheduleResolve(reason: symbol): void {
    if (this._resolveReasons?.has(reason)) return;
    (this._resolveReasons ??= new Set()).add(reason);
    this.rctx.scheduler.scheduleResolve(this);
  }

  unscheduleResolve(reason: symbol): void {
    if (this._resolveReasons?.delete(reason)) {
      this.rctx.scheduler.unscheduleResolve(this);
    }
  }

  scheduleEffect(reason: symbol): void {
    if (this._effectReasons?.has(reason)) return;
    (this._effectReasons ??= new Set()).add(reason);
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
    const gen = this.pendingGen ?? this.invokeUpdates(this._children);
    this.pendingGen = gen;
    const result = yield* gen;
    this.pendingGen = undefined;
    this._renderReasons?.clear();
    this.pendingSlots = result.slots;
    this.pendingKeyIndex = result.keyIndex;
    this.pendingDomUpdates = result.domUpdates;
    this._children = result.nextChildren;
    this._unmountedChildren = result.unmountedChildren;
  }

  private *invokeUpdates(children: Map<string, BaseInstance> = new Map()): Generator<
    void,
    ReconcileResult & {
      domUpdates: DomResult[];
      unmountedChildren: Set<BaseInstance>;
      nextChildren: Map<string, BaseInstance>;
    }
  > {
    const generator = this.render(this.props);
    const domUpdates: Array<DomResult> = [];
    const unmountedChildren = new Set(children.values());
    const newChildren = new Set<BaseInstance>();
    const updatedChildren = new Map<BaseInstance, VNode>();
    const nextChildren = new Map<string, BaseInstance>(children);
    let result = generator.next();
    while (!result.done) {
      if (Date.now() >= BaseInstance.sliceDeadline) yield;
      if (!result.value) {
        result = generator.next();
        continue;
      }
      const next = result.value;
      if (next.type === "UPDATE_UI") {
        domUpdates.push(next);
        result = generator.next();
        continue;
      }
      if (next.type === "ENSURE_PROPS") {
        const { instance, vnode } = next;
        unmountedChildren.delete(instance);
        updatedChildren.set(instance, vnode);
        result = generator.next();
        continue;
      }
      const { vnode, parentDom, slotPath } = next;
      const instance = children.get(slotPath);
      if (instance) {
        unmountedChildren.delete(instance);
        updatedChildren.set(instance, vnode);
        result = generator.next(instance);
        continue;
      }
      const newInstance = createInstanceFn(slotPath, vnode, this.ctx, this, this.rctx, parentDom);
      newChildren.add(newInstance);
      nextChildren.set(slotPath, newInstance);
      result = generator.next(newInstance);
    }

    const { scheduler } = this.rctx;
    if (domUpdates.length) scheduler.scheduleDOMUpdate(this);
    else scheduler.unscheduleDOMUpdate(this);

    if (unmountedChildren.size) scheduler.scheduleUnmountChildren(this);
    else scheduler.unscheduleUnmountChildren(this);

    for (const instance of newChildren) instance.scheduleRender(MOUNT_REASON);

    for (const instance of unmountedChildren) instance.unmount();

    for (const [instance, props] of updatedChildren) instance.setProps(props);

    return { ...result.value, domUpdates, unmountedChildren, nextChildren };
  }

  protected abstract render(
    props: Record<string, unknown>,
  ): Generator<OptionalUpdateResult, ReconcileResult, BaseInstance>;

  protected reconcile(children: IterableChild) {
    if(this.slots?.length) {
      return reconcile(children, this, this.parentDom, this.endAnchor, "", this.slots, this.keyIndex)
    }
    return build(children, this, this.parentDom, this.endAnchor, "")
  }

  updateDOM(): void {
    if (this.isUnmounted()) return;
    try {
      for (const update of this.pendingDomUpdates) update.callback();
    } catch (e: any) {
      throw new Error(this.debugLabel(), { cause: e });
    } finally {
      this.pendingDomUpdates.length = 0;
      this.slots = this.pendingSlots;
      this.keyIndex = this.pendingKeyIndex;
    }
  }

  resolveStatePromises() {
    this._resolveReasons?.clear();
    if (!this._hookStates) return;
    for (const state of this._hookStates) {
      if (state.type === $STATE) {
        state.pendingResolve?.();
        state.pendingResolve = undefined;
      }
    }
  }

  unmountUnmounted() {
    if (this._unmountedChildren?.size) {
      const children = this._children;
      for (const child of this._unmountedChildren) {
        child.unmountLeafsFirst();
        children?.delete(child.childId);
      }
      this._unmountedChildren.clear();
    }
  }

  runEffects() {
    if (!this._hookStates) return;
    for (const state of this._hookStates) {
      if (state.type === $EFFECT) {
        if (!state.controller) {
          const controller = new AbortController();
          state.controller = controller;
          void state.fn(controller.signal);
        } else if (state.dirty) {
          state.controller.abort();
          const controller = new AbortController();
          state.controller = controller;
          state.dirty = false;
          void state.fn(controller.signal);
        }
      }
    }
    this._effectReasons?.clear();
  }

  isUnmounted(): boolean {
    if (this._unmounted) return true;
    let { parent } = this;
    while (parent) {
      if (parent._unmounted) return true;
      parent = parent.parent;
    }
    return false;
  }

  /**
   * Mark this instance unmounted and unschedule any pending render. The
   * actual hook cleanup (effect aborts, context unsubscribes, pending
   * resolve clears) runs later via the parent's `unmountUnmounted()` →
   * `unmountLeafsFirst()` walk, driven by the scheduler after the parent's
   * render commits. DOM removal happens through the parent reconciler's
   * `removeRange` ops, not from here.
   */
  unmount(): void {
    if (this._unmounted) return;
    this._unmounted = true;
    this.pendingGen = undefined;
    // Drop any pending DOM ops — if `remount()` flips `_unmounted` back to
    // false without triggering a re-render, `updateDOM` must not fire ops
    // whose anchors may have been torn down or moved in the meantime.
    this.pendingDomUpdates.length = 0;
    const { scheduler } = this.rctx;
    if (this._renderReasons?.size) scheduler.unscheduleRender(this);
  }

  remount(): void {
    if (!this._unmounted) return;
    this._unmounted = false;
    const { scheduler } = this.rctx;
    if (this._renderReasons?.size) scheduler.scheduleRender(this);
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Abort effect controllers and unsubscribe from context handles,
   * recursing into children first so cleanup runs leaf-up.
   */
  private unmountLeafsFirst(): void {
    const { _children, _hookStates } = this;
    if (_children) {
      for (const [, child] of _children) {
        child._unmounted = true;
        child.unmountLeafsFirst();
      }
    }
    if (!_hookStates) return;
    for (const state of _hookStates) {
      if (state.type === $EFFECT) {
        state.controller?.abort();
      } else if (state.type === $CONTEXT) {
        state.unsubscribe?.();
      } else if (state.type === $STATE) {
        state.pendingResolve = undefined;
      }
    }
    const { scheduler } = this.rctx;
    if (this._resolveReasons?.size) scheduler.unscheduleRender(this);
    if (this._effectReasons?.size) scheduler.unscheduleEffect(this);
    if (this._resolveReasons?.size) scheduler.unscheduleResolve(this);
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
