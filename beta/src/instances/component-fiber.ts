import { resolveContext } from "../context";
import type { Children, Component } from "../jsx";
import type { ContextMap, HookState, RenderContext } from "../render/types";
import type {
  CreateElementAction,
  CreateFragmentAction,
  CreateSlotResponse,
  CreateTextAction,
  UIAction,
} from "../reconciler/actions";
import { mountFiberChildren, reconcileFiberChildren } from "../reconciler/reconciler";
import { MOUNT_REASON, PROPS_REASON } from "../render-reasons";
import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  FragmentSlotType,
  Slot,
  TextSlotType,
} from "../slots/slot";
import { extendIntentNodes, extendIntentWithInstance } from "../slots/slot";
import type { RefLike } from "../render/element-props";
import type { AnyElement, TagNamespace } from "../render/elements/namespaces";
import type { DependencyList, DraftBy } from "../general-types";
import { depsChanged, propsWithChildren, shallowEqual } from "../general";
import { runHooks } from "../hooks/utils";
import { DeferContext } from "../hooks/defer";
import { prepareSlotNodes, updateWithPreparedSlot } from "../slots/utils";
import { createInstance } from "./register-create";
import type { SlotIntent } from "../slots/slot-intent";

export class ComponentFiber<TProps extends Record<string, unknown> = Record<string, unknown>> {
  public readonly ns: TagNamespace;
  public preparedSlots: Map<string, Slot> | undefined;
  unmounted: boolean | undefined = undefined;
  readonly component: Component;
  readonly depth: number;
  readonly parent: ComponentFiber | null;
  parentDom: Node;
  domActions: Array<UIAction> | undefined;

  ctx: ContextMap;
  readonly rctx: RenderContext;

  instances?: Map<string, ComponentFiber> = undefined;
  unmountInstances?: Set<ComponentFiber> = undefined;
  hookStates?: HookState[] = undefined;
  renderReasons?: Set<symbol> = undefined;
  resolveReasons?: Set<symbol> = undefined;
  effectReasons?: Set<symbol> = undefined;
  refs?: Map<AnyElement, RefLike> = undefined;
  nextRefs?: Map<AnyElement, RefLike> = undefined;

  slot?: Slot = undefined;
  pendingSlot?: Slot = undefined;

  protected props: TProps & { children: Children };
  readonly headNode: Comment;
  readonly tailNode: Comment;

  deps?: DependencyList;
  mounted = false;

  readonly path: string;

  constructor(
    intent: Omit<DraftBy<Slot<ComponentSlotType>, "instance" | "prevProps">, "type">,
    ctx: ContextMap,
    parent: ComponentFiber | null,
    rctx: RenderContext,
    parentDom: Node,
    ns: TagNamespace,
  ) {
    this.headNode = intent.headNode;
    this.tailNode = intent.tailNode;
    this.path = intent.path;
    this.component = intent.component;
    this.parent = parent;
    this.ctx = ctx;
    this.parentDom = parentDom;
    this.rctx = rctx;
    this.props = propsWithChildren(intent) as TProps & { children: Children };
    this.deps = intent.deps;
    this.depth = (parent?.depth ?? -1) + 1;
    this.ns = ns;
  }

  deferred() {
    return resolveContext(this.ctx, DeferContext);
  }

  scheduleRender(reason: symbol, deferred?: boolean): void {
    (this.renderReasons ??= new Set()).add(reason);
    this.rctx.scheduler.scheduleRender(this, deferred);
  }

  unscheduleRender(reason: symbol, deferred?: boolean): void {
    this.renderReasons?.delete(reason);
    if (this.renderReasons?.size === 0) {
      this.rctx.scheduler.unscheduleRender(this, deferred);
    }
  }

  scheduleResolve(reason: symbol): void {
    if (this.resolveReasons?.has(reason)) return;
    (this.resolveReasons ??= new Set()).add(reason);
    this.rctx.scheduler.scheduleResolve(this);
  }

  unscheduleResolve(reason: symbol): void {
    this.resolveReasons?.delete(reason);
    if (this.resolveReasons?.size === 0) {
      this.rctx.scheduler.unscheduleResolve(this);
    }
  }

  scheduleEffect(reason: symbol): void {
    if (this.effectReasons?.has(reason)) return;
    (this.effectReasons ??= new Set()).add(reason);
    this.rctx.scheduler.scheduleEffect(this);
  }

  protected apply(): Slot {
    const gen = this.component(this.props);
    const child = runHooks(gen, this);
    const start = Date.now();
    let slot: Slot;
    if (!this.slot) {
      slot = mountFiberChildren(this, child);
    } else {
      slot = reconcileFiberChildren(this, child);
    }
    const dur = Date.now() - start;
    if (dur > 40) console.log("dur", dur);
    return slot;
  }

  updateSlotProps(slot: Slot<ComponentSlotType | ContextSlotType>) {
    const { instance, path } = slot;
    if (this.unmountInstances?.delete(instance)) instance.unmounted = false;
    instance.setProps(slot);
    (this.instances ??= new Map<string, ComponentFiber>()).set(path, instance);
  }

  updateRef(slot: SlotIntent<ElementSlotType>) {
    const { headNode, props } = slot;
    (this.nextRefs ??= new Map()).set(headNode!, props.ref!);
  }

  mountSlot(
    intent: SlotIntent<ComponentSlotType | ContextSlotType>,
    parentDom: Node,
    ns: TagNamespace,
    ctx: ContextMap,
  ) {
    const { path } = intent;
    const existingInstance = this.instances?.get(path);
    let instance: ComponentFiber;
    if (existingInstance) {
      instance = existingInstance;
      instance.ctx = ctx;
      instance.parentDom = parentDom;
      extendIntentWithInstance(intent, instance);
      if (this.unmountInstances?.delete(instance)) instance.unmounted = false;
      instance.setProps(intent);
    } else {
      instance = createInstance(extendIntentNodes(intent), ctx, this, this.rctx, parentDom, ns);
      intent.instance = instance;
      instance.scheduleRender(MOUNT_REASON);
    }
    (this.instances ??= new Map<string, ComponentFiber>()).set(path, instance);
    return intent as Slot<ComponentSlotType>;
  }

  createNode(action: CreateElementAction): CreateSlotResponse<ElementSlotType>;
  createNode(action: CreateFragmentAction): CreateSlotResponse<FragmentSlotType>;
  createNode(action: CreateTextAction): CreateSlotResponse<TextSlotType>;
  createNode(
    action: CreateElementAction | CreateFragmentAction | CreateTextAction,
  ): CreateSlotResponse<any> {
    const { preparedSlots, rctx } = this;
    const { slot, ns } = action;
    const { path } = slot;
    const prepared = preparedSlots!.get(path);
    let resultSlot: Slot<ElementSlotType | TextSlotType | FragmentSlotType>;
    if (prepared) {
      resultSlot = updateWithPreparedSlot(slot, prepared, rctx.delegationRoot);
    } else {
      resultSlot = prepareSlotNodes(slot, rctx.delegationRoot, ns);
    }
    preparedSlots!.set(path, resultSlot);
    return resultSlot;
  }

  render() {
    const slot = this.apply();
    const { scheduler } = this.rctx;
    const { unmountInstances } = this;
    if (unmountInstances?.size) {
      scheduler.scheduleUnmountChildren(this);
      for (const instance of unmountInstances) instance.unmount();
    } else {
      scheduler.unscheduleUnmountChildren(this);
    }
    const { nextRefs, domActions } = this;
    if (domActions!.length || nextRefs) {
      scheduler.scheduleDOMUpdate(this);
    } else {
      this.preparedSlots?.clear();
      scheduler.unscheduleDOMUpdate(this);
    }
    this.renderReasons?.clear();
    this.pendingSlot = slot;
    if (!this.mounted) this.scheduleEffect(MOUNT_REASON);
  }

  // Rename and flip to isMounted
  isUnmounted(): boolean {
    let { parent } = this;
    while (parent) {
      if (parent.unmounted) return true;
      parent = parent.parent;
    }
    return false;
  }

  unmount(): void {
    if (this.unmounted) return;
    this.unmounted = true;
    const { scheduler } = this.rctx;
    if (this.renderReasons?.size) scheduler.unscheduleRender(this);
  }

  setProps(
    intent: Omit<
      DraftBy<Slot<ComponentSlotType | ContextSlotType>, "instance" | "prevProps">,
      "type"
    >,
  ): void {
    const { deps } = intent;
    if (!depsChanged(this.deps, deps)) return;
    this.deps = deps;
    const props = propsWithChildren(intent);
    if (shallowEqual(this.props, props)) return;
    this.props = props as TProps & { children: Children };
    this.scheduleRender(PROPS_REASON);
  }
}
