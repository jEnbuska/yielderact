import type { Context } from "../context";
import { resolveCtxValue } from "../context";
import { $CONTEXT, $EFFECT, $STATE } from "../hooks/descriptors";
import type { DependencyList } from "../hooks/types";
import { depsChanged } from "../hooks/utils";
import type { Child, VNodeProps } from "../jsx";
import { propsWithChildren, shallowEqual } from "../prop-helpers";
import type { ContextMap, HookState, RenderContext } from "../render/types";
import type { DelegationAction } from "../reconciler/delegation";
import { deferUi } from "../reconciler/delegation";
import { mountRoot, reconcileRoot } from "../reconciler/reconciler";
import { MOUNT_REASON, PROPS_REASON } from "../render-reasons";
import { Defer } from "./defer-context";
import type {
  ComponentSlotType,
  ContextSlotType,
  InstanceSlotNodes,
  Slot,
  SlotChild,
  SlotIntent,
} from "../slots/slot";
import { intentToSlot } from "../slots/slot";
import type { RefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";

type CreateInstance = (
  headNode: Comment,
  tailNode: Comment,
  intent: SlotIntent<ComponentSlotType | ContextSlotType>,
  parentCtx: ContextMap,
  parent: BaseInstance | null,
  rctx: RenderContext,
  parentDom: Node,
  ns: TagNamespace,
) => BaseInstance;

let createInstance: CreateInstance;

export function registerCreateInstance(callback: CreateInstance): void {
  createInstance = callback;
}

type InstanceReconcileResult = {
  domUpdates: Array<() => void>;
  reverseDomUpdates: Array<() => void>;
  unmountedInstances: Set<BaseInstance> | undefined;
  instances: Map<string, BaseInstance> | undefined;
  refs: Map<SlotElement, RefLike> | undefined;
  slots: Slot;
};
type RenderGenerator = Generator<void, InstanceReconcileResult>;

export abstract class BaseInstance<
  T extends ComponentSlotType | ContextSlotType = ComponentSlotType | ContextSlotType,
> {
  public readonly ns: TagNamespace;
  protected unmounted?: boolean;
  readonly contextKey?: Context = undefined;
  readonly vnode: SlotChild<T>;
  readonly depth: number;
  readonly parent: BaseInstance | null;
  parentDom: Node;
  protected domUpdates: Array<() => void> = [];
  protected pendingReverseDomUpdates: Array<() => void> = [];

  readonly ctx: ContextMap;
  readonly rctx: RenderContext;

  private instances?: Map<string, BaseInstance> = undefined;
  private unmountedInstances?: Set<BaseInstance> = undefined;
  public hookStates?: HookState[] = undefined;
  private renderReasons?: Set<symbol> = undefined;
  private resolveReasons?: Set<symbol> = undefined;
  private effectReasons?: Set<symbol> = undefined;
  private refs?: Map<SlotElement, RefLike> = undefined;
  private nextRefs?: Map<SlotElement, RefLike> = undefined;

  slot?: Slot = undefined;
  pendingSlots?: Slot = undefined;

  private props: VNodeProps;
  private pendingRender?: RenderGenerator = undefined;
  readonly headNode: Comment;
  readonly tailNode: Comment;

  deps?: DependencyList;
  protected mounted = false;

  protected readonly path: string;

  constructor(
    headNode: Comment,
    tailNode: Comment,
    path: string,
    vnode: SlotChild<T>,
    ctx: ContextMap,
    parent: BaseInstance | null,
    rctx: RenderContext,
    parentDom: Node,
    ns: TagNamespace,
  ) {
    this.headNode = headNode;
    this.tailNode = tailNode;
    this.path = path;
    this.vnode = vnode;
    this.parent = parent;
    this.ctx = ctx;
    this.parentDom = parentDom;
    this.rctx = rctx;
    this.props = propsWithChildren(vnode.props);
    this.deps = vnode.props.deps;
    this.depth = (parent?.depth ?? -1) + 1;
    this.ns = ns;
  }

  deferred() {
    return resolveCtxValue(this.ctx, Defer);
  }

  scheduleRender(reason: symbol, deferred?: boolean): void {
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

  *apply(): Generator<void, void, void> {
    if (this.isUnmounted()) return;
    const gen = this.pendingRender ?? this.invokeUpdates(this.instances);
    this.pendingRender = gen;
    const result = yield* gen;
    this.pendingRender = undefined;
    this.renderReasons?.clear();
    this.pendingSlots = result.slots;
    this.domUpdates = result.domUpdates;
    this.pendingReverseDomUpdates = result.reverseDomUpdates;
    this.nextRefs = result.refs;
    this.instances = result.instances;
    this.unmountedInstances = result.unmountedInstances;
    if (!this.mounted) this.scheduleEffect(MOUNT_REASON);
  }

  private preparedInstances: Map<string, BaseInstance> | undefined;

  private *invokeUpdates(instances: Map<string, BaseInstance> | undefined): RenderGenerator {
    const generator = this.render(this.props);
    const domUpdates: Array<() => void> = [];
    const reverseDomUpdates: Array<() => void> = [];
    let unmountedInstances: Set<BaseInstance> | undefined = instances?.size
      ? new Set(instances.values())
      : undefined;
    let newInstances: Set<BaseInstance> | undefined;
    let updatedInstances: Map<BaseInstance, VNodeProps> | undefined;
    let nextInstances: Map<string, BaseInstance> | undefined = instances?.size
      ? new Map()
      : undefined;
    let result = generator.next();
    let refs: undefined | Map<SlotElement, RefLike> = undefined;

    function handleSetProps(instance: BaseInstance, props: VNodeProps) {
      unmountedInstances ??= new Set(instances?.values());
      unmountedInstances.delete(instance);
      updatedInstances ??= new Map<BaseInstance, VNodeProps>();
      updatedInstances.set(instance, props);
      nextInstances ??= new Map();
      nextInstances?.set(instance.path, instance);
    }

    while (!result.done) {
      const next = result.value;
      switch (next.type) {
        case "UI":
          if (next.reverse) reverseDomUpdates.push(next.callback);
          else domUpdates.push(next.callback);
          result = generator.next();
          break;
        case "PROPS": {
          const { instance, props } = next;
          handleSetProps(instance, props);
          result = generator.next();
          break;
        }
        case "REF": {
          refs ??= new Map();
          refs!.set(next.element, next.ref);
          result = generator.next();
          break;
        }
        case "MOUNT": {
          const { intent, parentDom, ns } = next;
          const { path, child } = intent;
          const existingInstance = instances?.get(path);
          let instance: BaseInstance;
          if (existingInstance) {
            handleSetProps(existingInstance, child.props);
            instance = existingInstance;
          } else {
            const preparedInstance = this.preparedInstances?.get(path);
            if (preparedInstance) {
              instance = preparedInstance;
              newInstances ??= new Set<BaseInstance>();
              newInstances.add(instance);
              nextInstances ??= new Map<string, BaseInstance>(instances);
              nextInstances.set(path, instance);
            } else {
              const { name } = intent.child.type;
              const headNode = document.createComment(`<${name}>`);
              const tailNode = document.createComment(`</${name}>`);
              instance = createInstance(
                headNode,
                tailNode,
                intent,
                this.ctx,
                this,
                this.rctx,
                parentDom,
                ns,
              );
              newInstances ??= new Set<BaseInstance>();
              newInstances.add(instance);
              nextInstances ??= new Map<string, BaseInstance>(instances);
              nextInstances.set(path, instance);
              this.preparedInstances ??= new Map();
              this.preparedInstances.set(path, instance);
            }
          }
          intentToSlot(intent as any, instance.headNode, instance.tailNode, instance);
          result = generator.next(intent as Slot<ComponentSlotType | ContextSlotType>);
        }
      }
    }

    const { scheduler } = this.rctx;

    if (unmountedInstances?.size) scheduler.scheduleUnmountChildren(this);
    else scheduler.unscheduleUnmountChildren(this);

    if (newInstances) {
      for (const instance of newInstances) {
        instance.scheduleRender(MOUNT_REASON);
      }
    }
    if (domUpdates.length) scheduler.scheduleDOMUpdate(this);
    else scheduler.unscheduleDOMUpdate(this);
    if (reverseDomUpdates.length) scheduler.scheduleReverseDOMUpdate(this);
    else scheduler.unscheduleReverseDOMUpdate(this);

    if (unmountedInstances) {
      for (const instance of unmountedInstances.values()) instance.unmount();
    }

    if (updatedInstances) {
      for (const [instance, props] of updatedInstances) instance.setProps(props);
    }

    this.preparedInstances = undefined;
    return {
      domUpdates,
      unmountedInstances,
      instances: nextInstances ?? instances,
      refs,
      slots: result.value,
      reverseDomUpdates,
    };
  }

  protected abstract render(
    props: Record<string, unknown>,
  ): Generator<DelegationAction, Slot, InstanceSlotNodes>;

  protected *reconcile(child: Child) {
    if (!this.slot) {
      const stagingDom = document.createDocumentFragment();
      const result = yield* mountRoot(child, this, this.parentDom, stagingDom, this.ns);
      yield deferUi(() => this.parentDom.insertBefore(stagingDom, this.tailNode));
      return result;
    }
    return yield* reconcileRoot(child, this, this.parentDom, this.slot, this.ns, this.tailNode);
  }

  updateDOM(): void {
    if (this.isUnmounted()) return;
    for (const domUpdate of this.domUpdates) domUpdate();
    this.domUpdates.length = 0;
    this.slot = this.pendingSlots;
    this.updateRefs();
  }

  updateDOMReverse(): void {
    if (this.isUnmounted()) return;
    for (const domUpdate of this.pendingReverseDomUpdates) domUpdate();
    this.pendingReverseDomUpdates.length = 0;
    this.slot = this.pendingSlots;
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
    if (this.unmounted) return;
    this.mounted = true;
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
    this.domUpdates.length = 0;
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

  setProps(props: VNodeProps): void {
    const deps = props.deps;
    if (!depsChanged(this.deps, deps)) return;
    this.deps = deps;
    props = propsWithChildren(props);
    if (shallowEqual(this.props, props)) return;
    this.props = props;
    this.scheduleRender(PROPS_REASON);
  }
}
