import { resolveContext } from "../context";
import type { Children, Component } from "../jsx";
import type { ContextMap, HookState, RenderContext } from "../render/types";
import type { DelegationAction, DelegationResponse, UIAction } from "../reconciler/delegation";
import { $insertNode } from "../reconciler/delegation";
import { mountRoot, reconcileFiber, reconcileRoot } from "../reconciler/reconciler";
import { MOUNT_REASON, PROPS_REASON } from "../render-reasons";
import type { ComponentSlotType, ContextSlotType, Slot } from "../slots/slot";
import type { RefLike } from "../render/element-props";
import type { AnyElement, TagNamespace } from "../render/elements/namespaces";
import type { DependencyList, DraftBy } from "../general-types";
import { depsChanged, propsWithChildren, shallowEqual } from "../general";
import { runHooks } from "../hooks/utils";
import { Defer } from "./deferred-fiber";

export class ComponentFiber<TProps extends Record<string, unknown> = Record<string, unknown>> {
  public readonly ns: TagNamespace;
  public preparedSlots: Map<string, Omit<Slot, "stagingDom">> | undefined;
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
  pendingSlots?: Slot = undefined;

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
    intent.instance = this;
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
    return resolveContext(this.ctx, Defer);
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

  protected *apply(): Generator<DelegationAction, Slot, DelegationResponse> {
    const gen = this.component(this.props);
    const child = runHooks(gen, this);
    if (!this.slot) {
      const stagingDom = document.createDocumentFragment();
      const result = yield* mountRoot(child, this, this.parentDom, stagingDom, this.ns, this.ctx);
      yield $insertNode(this.parentDom, stagingDom, this.tailNode);
      return result;
    }
    return yield* reconcileRoot(
      child,
      this,
      this.parentDom,
      this.slot,
      this.ns,
      this.tailNode,
      this.ctx,
    );
  }

  render() {
    const result = reconcileFiber(this.apply(), this);
    const { scheduler } = this.rctx;
    const { renderInstances, unmountInstances, updateInstances } = result;
    if (renderInstances) {
      for (const instance of renderInstances) instance.scheduleRender(MOUNT_REASON);
    }
    if (updateInstances) {
      for (const slot of updateInstances) slot.instance.setProps(slot);
    }
    if (unmountInstances?.size) {
      scheduler.scheduleUnmountChildren(this);
      for (const instance of unmountInstances) instance.unmount();
    } else {
      scheduler.unscheduleUnmountChildren(this);
    }
    const { instances, domActions, refs } = result;

    if (domActions?.length || refs) {
      scheduler.scheduleDOMUpdate(this);
    } else {
      this.preparedSlots?.clear();
      scheduler.unscheduleDOMUpdate(this);
    }

    this.renderReasons?.clear();
    this.pendingSlots = result.slots;
    this.domActions = domActions;
    this.nextRefs = refs;
    this.instances = instances;
    this.unmountInstances = unmountInstances;
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
