import { BaseInstance } from "./base-instance";
import type { Child, VNode, VNodeProps } from "../jsx";
import type { Context, ContextHandle } from "../context";
import { resolveCtxValue } from "../context";
import type { ContextMap, RenderContext } from "../render/types";
import { reconcile } from "../reconciler/reconciler";
import type { OptionalUpdateResult, ReconcileResult } from "../reconciler/types";
import { Defer } from "./defer-context";

export class DeferredInstance extends BaseInstance<Context> {
  readonly contextKey: Context = Defer;
  readonly handle: ContextHandle<boolean>;
  private initialRender = true;

  constructor(
    childId: string,
    vnode: VNode<Context>,
    parentCtx: ContextMap,
    parent: BaseInstance | null,
    rctx: RenderContext,
    parentDom: Node,
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
    super(childId, vnode, extended, parent, rctx, parentDom);
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
    if (!resolveCtxValue(this.parent?.ctx, Defer) && this.initialRender) {
      // First mount under a non-deferred parent: keep children synchronous
      // so initial DOM appears immediately.
      this.handle.ref.current = false;
    } else {
      // Subsequent renders (or nested under another `<Defer>`): route
      // descendants through the deferred queue for time-sliced rendering.
      this.handle.ref.current = true;
    }
    return super.apply();
  }

  deferred(): boolean {
    return !this.initialRender || resolveCtxValue(this.parent?.ctx, Defer);
  }

  protected render(
    props: VNodeProps,
  ): Generator<OptionalUpdateResult, ReconcileResult, BaseInstance> {
    const children = (props["children"] as Child[]) ?? [];
    return this.reconcile(children);
  }
}
