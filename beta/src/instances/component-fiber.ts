import { resolveContext } from "../context";
import type { Component } from "../jsx";
import type { ContextMap, HookState, RenderContext } from "../render/types";
import type { UIAction } from "../reconciler/actions";
import { mountFiberChildren, reconcileFiberChildren } from "../reconciler/reconciler";
import { PROPS_REASON } from "../render-reasons";
import type { ComponentSlotType, ContextSlotType, Slot } from "../slots/slot";
import type { RefLike } from "../render/element-props";
import type { AnyElement, TagNamespace } from "../render/elements/namespaces";
import type { DependencyList, DraftBy } from "../general-types";
import { depsChanged, shallowEqual, stripFrameworkProps } from "../general";
import { runHooks } from "../hooks/utils";
import { DeferContext } from "../hooks/defer";

export class ComponentFiber<TProps extends Record<string, unknown> = Record<string, any>> {
  public rendered: boolean | undefined = undefined;
  public readonly ns: TagNamespace;
  public preparedSlots: Map<string, Slot> | undefined;

  unmounted: boolean | undefined = undefined;
  readonly component: Component;
  readonly depth: number;
  readonly parent: ComponentFiber | null;
  parentDom: Node;
  uiActions: Array<UIAction> | undefined = undefined;
  ctx: ContextMap;
  readonly rctx: RenderContext;
  instances?: Map<string, ComponentFiber> = undefined;
  nextInstances?: Map<string, ComponentFiber> = undefined;
  unmountInstances?: Map<string, ComponentFiber> = undefined;
  hookStates?: HookState[] = undefined;
  renderReasons = new Set<symbol>();
  resolveReasons?: Set<symbol> = undefined;
  effectReasons?: Set<symbol> = undefined;
  refs?: Map<AnyElement, RefLike> = undefined;
  nextRefs?: Map<AnyElement, RefLike> = undefined;
  slot?: Slot = undefined;
  pendingSlot?: Slot = undefined;
  protected props: TProps;
  protected propsPrepared = false;
  readonly headNode: Comment;
  readonly tailNode: Comment;

  deps?: DependencyList;

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
    this.props = intent.props as TProps;
    this.deps = intent.props.deps;
    this.depth = (parent?.depth ?? -1) + 1;
    this.ns = ns;
  }

  isDeferred() {
    return resolveContext(this.ctx, DeferContext);
  }

  scheduleRender(reason: symbol, deferred?: boolean): void {
    this.renderReasons.add(reason);
    this.rctx.scheduler.scheduleRender(this, deferred);
  }

  unscheduleRender(reason: symbol, deferred?: boolean): void {
    this.renderReasons.delete(reason);
    if (this.renderReasons.size) {
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
    this.rendered = true;
    if (!this.propsPrepared) {
      this.props = stripFrameworkProps<any>(this.props);
      this.propsPrepared = true;
    }
    const generator = this.component(this.props);
    const child = runHooks(generator, this);
    if (!this.slot) {
      this.pendingSlot = mountFiberChildren(this, child);
    } else {
      this.pendingSlot = reconcileFiberChildren(this, child);
    }
    const { unmountInstances, rctx } = this;
    const { scheduler } = rctx;
    if (unmountInstances?.size) {
      let scheduleUnmount = false;
      for (const instance of unmountInstances.values()) {
        if (instance.unmount()) {
          scheduleUnmount = true;
        } else {
          unmountInstances.delete(instance.path);
        }
      }
      if (scheduleUnmount) {
        scheduler.scheduleUnmountChildren(this);
      }
    } else {
      scheduler.unscheduleUnmountChildren(this);
    }
    const { nextRefs, uiActions } = this;
    if (uiActions!.length || nextRefs) {
      scheduler.scheduleUiUpdate(this);
    } else {
      this.preparedSlots?.clear();
      scheduler.unscheduleUiUpdate(this);
    }
    this.renderReasons.clear();
  }

  unmount(): boolean | undefined {
    this.unmounted = true;
    const { scheduler } = this.rctx;
    if (this.renderReasons.size) scheduler.unscheduleRender(this);
    return this.rendered;
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

  setProps(
    intent: Omit<
      DraftBy<Slot<ComponentSlotType | ContextSlotType>, "instance" | "prevProps">,
      "type"
    >,
  ): void {
    const { deps } = intent.props;
    if (!depsChanged(this.deps, deps)) return;
    this.deps = deps;
    const { props } = intent;
    if (shallowEqual(this.props, props)) return;
    this.props = props as TProps;
    this.propsPrepared = false;
    this.scheduleRender(PROPS_REASON);
  }
}
