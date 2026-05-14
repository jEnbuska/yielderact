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
import type { Child, Component, VNode, VNodeProps, VNodeType } from "../jsx";
import { propsWithChildren, shallowEqual } from "../prop-helpers";
import type { ContextMap, HookState, RenderContext } from "../render/types";
import type { DelegatedUI, OptionalDelegationAction, ReconcileResult } from "../reconciler/types";
import { reconcile } from "../reconciler/reconciler";
import { MOUNT_REASON, PROPS_REASON } from "../render-reasons";
import { Defer } from "./defer-context";
import { mount } from "../reconciler/mount";
import { $delegateUi } from "../reconciler/utils";
import type { Slot } from "../slots/slot";
import type { RefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";

type CreateInstanceFn = <T extends Context | Component>(
  childId: string,
  vnode: VNode<T>,
  parentCtx: ContextMap,
  parent: BaseInstance | null,
  rctx: RenderContext,
  parentDom: Node,
  ns: TagNamespace,
) => BaseInstance<T>;

let createInstanceFn: CreateInstanceFn;

export function registerCreateInstance(fn: CreateInstanceFn): void {
  createInstanceFn = fn;
}
export abstract class BaseInstance<TVNodeType extends VNodeType = VNodeType> {
  /** Time-slice deadline set by the scheduler. invokeUpdates yields when exceeded. */

  static sliceDeadline = Infinity;
  public readonly ns: TagNamespace;
  protected _unmounted?: boolean = false;
  readonly contextKey?: Context = undefined;
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
  protected pendingDomUpdates: DelegatedUI[] = [];
  /**
   * ContextMap this instance exposes to its children and reads for its own
   * `context` hooks. ComponentInstance keeps the parent map unchanged;
   * ContextInstance extends it with its own handle before calling `super`.
   */
  readonly ctx: ContextMap;
  readonly rctx: RenderContext;

  // Lazy collections — null until first write. Saves allocations on leaf
  // instances that never accumulate children, scheduling reasons, or hooks.

  private _children?: Map<string, BaseInstance> = undefined;
  private _unmountedChildren?: Set<BaseInstance> = undefined;
  private _hookStates?: HookState[] = undefined;
  private _renderReasons?: Set<symbol> = undefined;
  private _resolveReasons?: Set<symbol> = undefined;
  private _effectReasons?: Set<symbol> = undefined;
  private _refs?: Map<SlotElement, RefLike> = undefined;
  private _nextRefs?: Map<SlotElement, RefLike> = undefined;

  // Slot tree state — undefined until first apply assigns. Reconcile's
  // default params accept undefined, so subclasses can pass these through
  // without a fallback.
  slots?: Slot[] = undefined;
  pendingSlots?: Slot[] = undefined;
  keyIndex?: Map<string, number> = undefined;
  pendingKeyIndex?: Map<string, number> = undefined;
  private props: VNodeProps;

  /** Saved generator from an interrupted deferred render. */
  private pendingGen?: Generator<
    void,
    ReconcileResult & {
      domUpdates: DelegatedUI[];
      unmountedChildren: Set<BaseInstance>;
      nextChildren: Map<string, BaseInstance>;
      nextRefs: Map<SlotElement, RefLike> | undefined;
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
    ns: TagNamespace,
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
    this.ns = ns;
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
    this._nextRefs = result.nextRefs;
    this._children = result.nextChildren;
    this._unmountedChildren = result.unmountedChildren;
  }

  private *invokeUpdates(children: Map<string, BaseInstance> = new Map()): Generator<
    void,
    ReconcileResult & {
      domUpdates: DelegatedUI[];
      unmountedChildren: Set<BaseInstance>;
      nextChildren: Map<string, BaseInstance>;
      nextRefs: Map<SlotElement, RefLike> | undefined;
    }
  > {
    const generator = this.render(this.props);
    const domUpdates: Array<DelegatedUI> = [];
    const unmountedChildren = new Set(children.values());
    const newChildren = new Set<BaseInstance>();
    const updatedChildren = new Map<BaseInstance, VNode>();
    const nextChildren = new Map<string, BaseInstance>(children);
    let result = generator.next();
    let nextRefs: undefined | Map<SlotElement, RefLike> = undefined;
    while (!result.done) {
      if (Date.now() >= BaseInstance.sliceDeadline) yield;
      if (!result.value) {
        result = generator.next();
        continue;
      }

      const next = result.value;
      switch (next.type) {
        case "UI":
          domUpdates.push(next);
          result = generator.next();
          break;
        case "PROPS": {
          const { instance, vnode } = next;
          unmountedChildren.delete(instance);
          updatedChildren.set(instance, vnode);
          result = generator.next();
          break;
        }
        case "REF": {
          nextRefs ??= new Map();
          nextRefs.set(next.element, next.ref);
          next.ref.current = next.element;
          break;
        }
        case "MOUNT": {
          const { vnode, parentDom, path, ns } = next;
          const instance = children.get(path);
          if (instance) {
            unmountedChildren.delete(instance);
            updatedChildren.set(instance, vnode);
            result = generator.next(instance);
            continue;
          }
          const newInstance = createInstanceFn(
            path,
            vnode,
            this.ctx,
            this,
            this.rctx,
            parentDom,
            ns,
          );
          newChildren.add(newInstance);
          nextChildren.set(path, newInstance);
          result = generator.next(newInstance);
        }
      }
    }

    const { scheduler } = this.rctx;
    if (domUpdates.length) scheduler.scheduleDOMUpdate(this);
    else scheduler.unscheduleDOMUpdate(this);

    if (unmountedChildren.size) scheduler.scheduleUnmountChildren(this);
    else scheduler.unscheduleUnmountChildren(this);

    for (const instance of newChildren) instance.scheduleRender(MOUNT_REASON);

    for (const instance of unmountedChildren) instance.unmount();

    for (const [instance, props] of updatedChildren) instance.setProps(props);

    return { ...result.value, domUpdates, unmountedChildren, nextChildren, nextRefs };
  }

  protected abstract render(
    props: Record<string, unknown>,
  ): Generator<OptionalDelegationAction, ReconcileResult, BaseInstance>;

  protected *reconcile(children: Child[]) {
    if (!this.keyIndex) {
      const stagingDom = document.createDocumentFragment();
      const result = yield* mount(children, this, this.parentDom, stagingDom, "", this.ns);
      yield $delegateUi(() => this.parentDom.insertBefore(stagingDom, this.endAnchor));
      return result;
    }
    return yield* reconcile(
      children,
      this,
      this.parentDom,
      "",
      this.slots,
      this.keyIndex,
      this.ns,
      this.endAnchor,
    );
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
      if (this._nextRefs) {
        for (const [element, ref] of this._nextRefs) {
          const prev = this._refs?.get(element);
          if (prev) {
            prev.current = undefined;
            this._refs!.delete(element);
          }
          ref.current = element;
        }
      }
      if (this._refs) {
        for (const [element, ref] of this._refs) {
          if (element !== ref.current) continue;
          ref.current = undefined;
        }
      }
      this._refs = this._nextRefs;
      this._nextRefs = undefined;
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

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Abort effect controllers and unsubscribe from context handles,
   * recursing into children first so cleanup runs leaf-up.
   */
  private unmountLeafsFirst(): void {
    const { _children, _hookStates, _refs } = this;
    if (_children) {
      for (const [, child] of _children) {
        child._unmounted = true;
        child.unmountLeafsFirst();
      }
    }
    if (_refs) {
      for (const [element, ref] of _refs) {
        if (element !== ref.current) return;
        ref.current = undefined;
      }
    }

    if (_hookStates) {
      for (const state of _hookStates) {
        if (state.type === $EFFECT) {
          state.controller?.abort();
        } else if (state.type === $CONTEXT) {
          state.unsubscribe?.();
        } else if (state.type === $STATE) {
          state.pendingResolve = undefined;
        }
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
