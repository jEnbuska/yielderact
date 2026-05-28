import { resolveContext } from "../context";
import type { Children, Component } from "../jsx";
import type { ContextMap, HookState, RenderContext } from "../render/types";
import type { UIAction } from "../reconciler/actions";
import { mountFiberChildren, reconcileFiberChildren } from "../reconciler/reconciler";
import { MOUNT_REASON, PROPS_REASON } from "../render-reasons";
import type { ComponentSlotType, ContextSlotType, Slot } from "../slots/slot";
import type { RefLike } from "../render/element-props";
import type { AnyElement, TagNamespace } from "../render/elements/namespaces";
import type { DependencyList, DraftBy } from "../general-types";
import { depsChanged, propsWithChildren, shallowEqual } from "../general";
import { runHooks } from "../hooks/utils";
import { DeferContext } from "../hooks/defer";

export class ComponentFiber<TProps extends Record<string, unknown> = Record<string, unknown>> {
  public readonly ns: TagNamespace;
  public preparedSlots: Map<string, Slot> | undefined;
  unmounted: boolean | undefined = undefined;
  readonly component: Component;
  readonly depth: number;
  readonly parent: ComponentFiber | null;
  parentDom: Node;
  uiActions: Array<UIAction> | undefined;

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

  render() {
    const generator = this.component(this.props);
    const child = runHooks(generator, this);
    if (!this.slot) {
      this.pendingSlot = mountFiberChildren(this, child);
    } else {
      this.pendingSlot = reconcileFiberChildren(this, child);
    }
    const { scheduler } = this.rctx;
    const { unmountInstances } = this;
    if (unmountInstances?.size) {
      scheduler.scheduleUnmountChildren(this);
      for (const instance of unmountInstances) instance.unmount();
    } else {
      scheduler.unscheduleUnmountChildren(this);
    }
    const { nextRefs, uiActions } = this;
    if (uiActions!.length || nextRefs) {
      scheduler.scheduleDOMUpdate(this);
    } else {
      this.preparedSlots?.clear();
      scheduler.unscheduleDOMUpdate(this);
    }
    this.renderReasons?.clear();
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
