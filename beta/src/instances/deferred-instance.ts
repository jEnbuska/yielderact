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
    index: number,
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
    super(childId, vnode, extended, index, parent, rctx, parentDom);
    this.handle = handle;
  }

  commit() {
    this.initialRender = false;
    this.handle.ref.current = false;
    super.commit();
  }

  apply() {
    if (!resolveCtxValue(this.parent?.ctx, Defer) && (this.initialRender || this.isUnmounted())) {
      this.handle.ref.current = false;
      return super.apply();
    }
    this.handle.ref.current = true;
    return super.apply();
  }

  deferred(): boolean {
    return !this.initialRender || resolveCtxValue(this.parent?.ctx, Defer);
  }

  protected render(
    props: VNodeProps,
  ): Generator<OptionalUpdateResult, ReconcileResult, BaseInstance> {
    const children = (props["children"] as Child[]) ?? [];
    return reconcile(children, this, this.parentDom, this.endAnchor, "", this.slots, this.keyIndex);
  }
}
