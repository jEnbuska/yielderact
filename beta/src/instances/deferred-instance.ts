import { BaseInstance } from "./base-instance";
import type { Child, VNode, VNodeProps } from "../jsx";
import { Fragment } from "../jsx";
import type { Context, ContextHandle } from "../context";
import { resolveCtxValue } from "../context";
import type { ContextMap, RenderContext } from "../render/types";
import type { OptionalDelegationAction } from "../reconciler/delegation";
import { Defer } from "./defer-context";
import type { TagNamespace } from "../render/elements/namespaces";
import type { ContextSlotType, Slot } from "../slots/slot";

export class DeferredInstance extends BaseInstance<ContextSlotType> {
  readonly contextKey: Context = Defer;
  readonly handle: ContextHandle<boolean>;
  private initialRender = true;

  constructor(
    headNode: Comment,
    tailNode: Comment,
    path: string,
    vnode: VNode<ContextSlotType>,
    parentCtx: ContextMap,
    parent: BaseInstance | null,
    rctx: RenderContext,
    parentDom: Node,
    ns: TagNamespace,
  ) {
    const extended = new Map(parentCtx);
    const handle: ContextHandle<boolean> = {
      ref: { current: resolveCtxValue(parentCtx, Defer) },
      subscribe: () => {
        return () => {};
      },
      depth: (parent?.depth ?? -1) + 1,
    };
    extended.set(Defer, handle);
    super(headNode, tailNode, path, vnode, extended, parent, rctx, parentDom, ns);
    this.handle = handle;
  }

  runEffects() {
    this.initialRender = false;
    this.handle.ref.current = false;
  }

  override apply() {
    // Schedule an effect every render so `runEffects()` fires after the
    // commit pass and flips the handle back to `false`. Without this,
    // descendant updates after a deps-change would stay routed to the
    // deferred queue indefinitely, instead of going back to primary once
    // the in-flight deferred batch settles.
    this.rctx.scheduler.scheduleEffect(this);
    this.handle.ref.current = !(!resolveCtxValue(this.parent?.ctx, Defer) && this.initialRender);
    return super.apply();
  }

  deferred(): boolean {
    return !this.initialRender || resolveCtxValue(this.parent?.ctx, Defer);
  }

  protected render(props: VNodeProps): Generator<OptionalDelegationAction, Slot, BaseInstance> {
    const children = (props["children"] as Child[]) ?? [];
    return this.reconcile({
      type: Fragment,
      props: { children },
    });
  }
}
