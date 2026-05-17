import type { Context } from "../context";
import { resolveCtxValue } from "../context";
import { $CONTEXT, $EFFECT, $STATE } from "../hooks/descriptors";
import type { DependencyList } from "../hooks/types";
import { depsChanged } from "../hooks/utils";
import type { Component, SingleChild, VNode, VNodeProps, VNodeType } from "../jsx";
import { propsWithChildren, shallowEqual } from "../prop-helpers";
import type { ContextMap, HookState, RenderContext } from "../render/types";
import type { OptionalDelegationAction } from "../reconciler/types";
import { reconcileRoot } from "../reconciler/reconciler";
import { MOUNT_REASON, PROPS_REASON } from "../render-reasons";
import { Defer } from "./defer-context";
import { mountRoot } from "../reconciler/mount";
import { $delegateUi } from "../reconciler/utils";
import type { Slot } from "../slots/slot";
import type { RefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";

type CreateInstanceFn = <T extends Context | Component>(
  path: string,
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

type InstanceReconcileResult = {
  domUpdates: Array<() => void>;
  unmountedInstances: Set<BaseInstance> | undefined;
  nextInstances: Map<string, BaseInstance> | undefined;
  nextRefs: Map<SlotElement, RefLike> | undefined;
  nextSlot: Slot;
  nextKey: string;
};
type RenderGenerator = Generator<void, InstanceReconcileResult>;

export abstract class BaseInstance<TVNodeType extends VNodeType = VNodeType> {
  /** Time-slice deadline set by the scheduler. invokeUpdates yields when exceeded. */

  static sliceDeadline = Infinity;

  public readonly ns: TagNamespace;
  protected unmounted?: boolean;
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
  protected pendingDomUpdates: Array<() => void> = [];
  /**
   * ContextMap this instance exposes to its children and reads for its own
   * `context` hooks. ComponentInstance keeps the parent map unchanged;
   * ContextInstance extends it with its own handle before calling `super`.
   */
  readonly ctx: ContextMap;
  readonly rctx: RenderContext;

  // Lazy collections — null until first write. Saves allocations on leaf
  // instances that never accumulate children, scheduling reasons, or hooks.

  private instances?: Map<string, BaseInstance> = undefined;
  private unmountedInstances?: Set<BaseInstance> = undefined;
  public hookStates?: HookState[] = undefined;
  private renderReasons?: Set<symbol> = undefined;
  private resolveReasons?: Set<symbol> = undefined;
  private effectReasons?: Set<symbol> = undefined;
  private refs?: Map<SlotElement, RefLike> = undefined;
  private nextRefs?: Map<SlotElement, RefLike> = undefined;

  slot?: Slot = undefined;
  nextSlot?: Slot = undefined;

  key?: string = undefined;
  nextKey?: string = undefined;

  private props: VNodeProps;

  /** Saved generator from an interrupted deferred render. */
  private pendingRender?: RenderGenerator = undefined;

  /**
   * DOM anchor pair delimiting this instance's subtree. Everything between
   * `startAnchor.nextSibling` and `endAnchor` belongs to this instance.
   * The reconciler moves/inserts/removes the instance by walking this range.
   */
  readonly startAnchor: Comment;
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

  path: string;

  constructor(
    path: string,
    vnode: VNode<TVNodeType>,
    ctx: ContextMap,
    parent: BaseInstance | null,
    rctx: RenderContext,
    parentDom: Node,
    ns: TagNamespace,
  ) {
    this.path = path;
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
    this.pendingRender = undefined;
    (this.renderReasons ??= new Set()).add(reason);
    this.rctx.scheduler.scheduleRender(this, deferred);
  }

  unscheduleRender(reason: symbol, deferred?: boolean): void {
    if (this.renderReasons?.delete(reason)) {
      this.rctx.scheduler.unscheduleRender(this, deferred);
    }
  }

  scheduleResolve(reason: symbol): void {
    if (this.resolveReasons?.has(reason)) return;
    (this.resolveReasons ??= new Set()).add(reason);
    this.rctx.scheduler.scheduleResolve(this);
  }

  unscheduleResolve(reason: symbol): void {
    if (this.resolveReasons?.delete(reason)) {
      this.rctx.scheduler.unscheduleResolve(this);
    }
  }

  scheduleEffect(reason: symbol): void {
    if (this.effectReasons?.has(reason)) return;
    (this.effectReasons ??= new Set()).add(reason);
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
    const gen = this.pendingRender ?? this.invokeUpdates(this.instances);
    this.pendingRender = gen;
    const result = yield* gen;
    this.pendingRender = undefined;
    this.renderReasons?.clear();
    this.nextKey = result.nextKey;
    this.nextSlot = result.nextSlot;
    this.pendingDomUpdates = result.domUpdates;
    this.nextRefs = result.nextRefs;
    this.instances = result.nextInstances;
    this.unmountedInstances = result.unmountedInstances;
  }

  private pendingInstances: undefined | Map<string, BaseInstance> = undefined;

  private *invokeUpdates(instances: Map<string, BaseInstance> | undefined): RenderGenerator {
    const generator = this.render(this.props);
    const domUpdates: Array<() => void> = [];
    let unmountedInstances: Set<BaseInstance> | undefined = instances?.size
      ? new Set(instances.values())
      : undefined;
    let newInstances: Set<BaseInstance> | undefined;
    let updatedInstances: Map<BaseInstance, VNode> | undefined;
    let nextInstances: Map<string, BaseInstance> | undefined = instances?.size
      ? new Map()
      : undefined;
    let result = generator.next();
    let nextRefs: undefined | Map<SlotElement, RefLike> = undefined;

    function handleSetProps(instance: BaseInstance, vnode: VNode) {
      unmountedInstances ??= new Set(instances?.values());
      unmountedInstances.delete(instance);
      updatedInstances ??= new Map<BaseInstance, VNode>();
      updatedInstances.set(instance, vnode);
      nextInstances ??= new Map();
      nextInstances?.set(instance.path, instance);
    }

    while (!result.done) {
      yield;
      if (!result.value) {
        result = generator.next();
        continue;
      }

      const next = result.value;
      switch (next.type) {
        case "UI":
          domUpdates.push(next.callback);
          result = generator.next();
          break;
        case "PROPS": {
          const { instance, vnode } = next;
          handleSetProps(instance, vnode);
          result = generator.next();
          break;
        }
        case "REF": {
          nextRefs ??= new Map();
          nextRefs!.set(next.element, next.ref);
          result = generator.next();
          break;
        }
        case "MOUNT": {
          const { vnode, parentDom, path, ns } = next;
          const existingInstance = instances?.get(path);
          const pendingInstance = this.pendingInstances?.get(path);
          let instance: BaseInstance;
          if (existingInstance) {
            handleSetProps(existingInstance, vnode);
            instance = existingInstance;
            /*} else if (pendingInstance) {
              handleSetProps(pendingInstance, vnode);
              instance = pendingInstance;
              newInstances ??= new Set<BaseInstance>();
              newInstances.add(instance);*/
          } else {
            instance = createInstanceFn(path, vnode, this.ctx, this, this.rctx, parentDom, ns);
            this.pendingInstances ??= new Map();
            newInstances ??= new Set<BaseInstance>();
            newInstances.add(instance);
            nextInstances ??= new Map<string, BaseInstance>(instances);
            nextInstances.set(path, instance);
          }
          result = generator.next(instance);
        }
      }
    }

    const { scheduler } = this.rctx;
    if (domUpdates.length) scheduler.scheduleDOMUpdate(this);
    else scheduler.unscheduleDOMUpdate(this);

    if (unmountedInstances?.size) scheduler.scheduleUnmountChildren(this);
    else scheduler.unscheduleUnmountChildren(this);

    if (newInstances) {
      for (const instance of newInstances) {
        if (instance.unmounted) {
        }
        instance.scheduleRender(MOUNT_REASON);
      }
    }

    if (unmountedInstances) {
      for (const instance of unmountedInstances.values()) instance.unmount();
    }

    if (updatedInstances) {
      for (const [instance, props] of updatedInstances) instance.setProps(props);
    }

    const { key, slot } = result.value;
    nextInstances ??= instances;
    return {
      domUpdates,
      unmountedInstances,
      nextInstances,
      nextRefs,
      nextKey: key,
      nextSlot: slot,
    };
  }

  protected abstract render(
    props: Record<string, unknown>,
  ): Generator<OptionalDelegationAction, { key: string; slot: Slot }, BaseInstance>;

  protected *reconcile(child: SingleChild) {
    if (!this.slot) {
      const stagingDom = document.createDocumentFragment();
      const result = yield* mountRoot(child, this, this.parentDom, stagingDom, this.ns);
      yield $delegateUi(() => this.parentDom.insertBefore(stagingDom, this.endAnchor));
      return result;
    }
    return yield* reconcileRoot(child, this, this.parentDom, this.slot, this.ns, this.endAnchor);
  }

  updateDOM(): void {
    if (this.isUnmounted()) return;
    for (const domUpdate of this.pendingDomUpdates) domUpdate();
    this.pendingDomUpdates.length = 0;
    this.slot = this.nextSlot;
    this.key = this.nextKey;
    this.updateRefs();
  }

  private updateRefs() {
    // Pass 1: release old refs that aren't being carried over with the same binding
    if (this.refs) {
      for (const [element, ref] of this.refs) {
        if (this.nextRefs?.get(element) === ref) continue; // unchanged binding
        if (ref.current === element) ref.current = undefined; // still ours to clear
      }
    }

    // Pass 2: assign all new refs
    if (this.nextRefs) {
      for (const [element, ref] of this.nextRefs) {
        ref.current = element;
      }
    }

    this.refs = this.nextRefs;
    this.nextRefs = undefined;
  }

  resolveStatePromises() {
    this.resolveReasons?.clear();
    if (!this.hookStates) return;
    for (const state of this.hookStates) {
      if (state.type === $STATE) {
        state.pendingResolve?.();
        state.pendingResolve = undefined;
      }
    }
  }

  unmountUnmounted() {
    if (this.unmountedInstances?.size) {
      const children = this.instances;
      for (const child of this.unmountedInstances) {
        child.unmountLeafsFirst();
        children?.delete(child.path);
      }
      this.unmountedInstances.clear();
    }
  }

  runEffects() {
    if (!this.hookStates) return;
    for (const state of this.hookStates) {
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
    this.effectReasons?.clear();
  }

  isUnmounted(): boolean {
    if (this.unmounted) return true;
    let { parent } = this;
    while (parent) {
      if (parent.unmounted) return true;
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
    if (this.unmounted) return;
    this.unmounted = true;
    this.pendingRender = undefined;
    this.pendingDomUpdates.length = 0;
    const { scheduler } = this.rctx;
    if (this.renderReasons?.size) scheduler.unscheduleRender(this);
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Abort effect controllers and unsubscribe from context handles,
   * recursing into children first so cleanup runs leaf-up.
   */
  private unmountLeafsFirst(): void {
    const { instances, hookStates, refs } = this;
    if (instances) {
      for (const [, child] of instances) {
        child.unmounted = true;
        child.unmountLeafsFirst();
      }
    }
    if (refs) {
      for (const [element, ref] of refs) {
        if (element !== ref.current) return;
        ref.current = undefined;
      }
    }

    if (hookStates) {
      for (const state of hookStates) {
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
    if (this.resolveReasons?.size) scheduler.unscheduleRender(this);
    if (this.effectReasons?.size) scheduler.unscheduleEffect(this);
    if (this.resolveReasons?.size) scheduler.unscheduleResolve(this);
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
