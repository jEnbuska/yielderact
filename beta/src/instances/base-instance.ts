import type { Context } from "../context";
import { resolveCtxValue } from "../context";
import type { DependencyList } from "../hooks/types";
import { depsChanged } from "../hooks/utils";
import type { Child, VNodeProps } from "../jsx";
import { propsWithChildren, shallowEqual } from "../prop-helpers";
import type { ContextMap, HookState, RenderContext } from "../render/types";
import type { DelegationAction, UIAction } from "../reconciler/delegation";
import { deferInsert } from "../reconciler/delegation";
import { mountRoot, reconcileRoot, resolveComponentRender } from "../reconciler/reconciler";
import { MOUNT_REASON, PROPS_REASON } from "../render-reasons";
import { Defer } from "./defer-context";
import type {
  ComponentSlotType,
  ContextSlotType,
  InstanceSlotNodes,
  Slot,
  SlotChild,
} from "../slots/slot";
import type { RefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";

export abstract class BaseInstance<
  T extends ComponentSlotType | ContextSlotType = ComponentSlotType | ContextSlotType,
> {
  public readonly ns: TagNamespace;
  unmounted?: boolean;
  readonly contextKey?: Context = undefined;
  readonly vnode: SlotChild<T>;
  readonly depth: number;
  readonly parent: BaseInstance | null;
  parentDom: Node;
  domActions: Array<Exclude<UIAction, { type: "REMOVE" }>> | undefined;

  readonly ctx: ContextMap;
  readonly rctx: RenderContext;

  instances?: Map<string, BaseInstance> = undefined;
  unmountInstances?: Set<BaseInstance> = undefined;
  removedSlots: Array<Slot> | undefined;
  hookStates?: HookState[] = undefined;
  renderReasons?: Set<symbol> = undefined;
  resolveReasons?: Set<symbol> = undefined;
  effectReasons?: Set<symbol> = undefined;
  refs?: Map<SlotElement, RefLike> = undefined;
  nextRefs?: Map<SlotElement, RefLike> = undefined;

  slot?: Slot = undefined;
  pendingSlots?: Slot = undefined;

  private props: VNodeProps;
  readonly headNode: Comment;
  readonly tailNode: Comment;

  deps?: DependencyList;
  mounted = false;

  readonly path: string;

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

  apply() {
    const result = resolveComponentRender(this.render(this.props), this);
    const { scheduler } = this.rctx;
    const { renderInstances, unmountInstances, updateInstances } = result;
    if (renderInstances) {
      for (const instance of renderInstances) instance.scheduleRender(MOUNT_REASON);
    }
    if (updateInstances) {
      for (const { instance, props } of updateInstances) instance.setProps(props);
    }
    if (unmountInstances?.size) {
      scheduler.scheduleUnmountChildren(this);
      for (const instance of unmountInstances) instance.unmount();
    } else {
      scheduler.unscheduleUnmountChildren(this);
    }
    const { instances, domActions, refs, removedSlots } = result;

    if (domActions || refs || removedSlots) {
      scheduler.scheduleDOMUpdate(this);
    } else {
      scheduler.unscheduleDOMUpdate(this);
    }

    this.renderReasons?.clear();
    this.pendingSlots = result.slots;
    this.domActions = domActions;
    this.removedSlots = removedSlots;
    this.nextRefs = refs;
    this.instances = instances;
    this.unmountInstances = unmountInstances;
    if (!this.mounted) this.scheduleEffect(MOUNT_REASON);
  }

  protected abstract render(
    props: Record<string, unknown>,
  ): Generator<DelegationAction, Slot, InstanceSlotNodes>;

  protected *reconcile(child: Child) {
    if (!this.slot) {
      const stagingDom = document.createDocumentFragment();
      const result = yield* mountRoot(child, this, this.parentDom, stagingDom, this.ns);
      yield deferInsert(this.parentDom, stagingDom, this.tailNode);
      return result;
    }
    return yield* reconcileRoot(child, this, this.parentDom, this.slot, this.ns, this.tailNode);
  }

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
