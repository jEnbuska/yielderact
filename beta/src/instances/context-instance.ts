/**
 * ContextInstance — a mounted context provider.
 *
 * Owns a stable `ContextHandle` whose identity never changes. The handle is
 * installed once into the instance's `ctx` map at construction time, so the
 * ContextMap is not mutated or re-propagated on value changes.
 *
 * On each `render()` the instance updates `handle.ref.current` to the new
 * value and fires the handle's subscribers (consumers installed via
 * `context` subscribe to this Set during their first hook run).
 *
 * The provider has no generator body and no hooks — it just reconciles its
 * `children` using the extended ctx map.
 */
import { type Context, type ContextHandle, isContext } from "../context";
import type { Child, VNode, VNodeProps } from "../jsx";
import { reconcile } from "../reconciler/reconciler";
import type { ContextMap, RenderContext } from "../render/types";
import { BaseInstance } from "./base-instance";
import type { OptionalUpdateResult, ReconcileResult } from "../reconciler/types";

export class ContextInstance extends BaseInstance<Context> {
  readonly contextKey: Context;
  readonly handle: ContextHandle;
  private subscribers!: Set<() => void>;

  constructor(
    childId: string,
    vnode: VNode<Context>,
    parentCtx: ContextMap,
    index: number,
    parent: BaseInstance | null,
    rctx: RenderContext,
    parentDom: Node,
  ) {
    if (!isContext(vnode.type)) {
      throw new Error(
        `yract-beta: ContextInstance constructed with non-context type ${String(vnode.type)}`,
      );
    }
    const ctxKey: Context = vnode.type;
    const initialValue = vnode.props["value"];

    // Build the stable handle up-front — its identity never changes.
    const subscribers = new Set<() => void>();
    const handle: ContextHandle = {
      ref: { current: initialValue },
      subscribe: (cb) => {
        subscribers.add(cb);
        return () => subscribers.delete(cb);
      },
    };

    const extended = new Map(parentCtx);
    extended.set(ctxKey, handle);

    super(childId, vnode, extended, index, parent, rctx, parentDom);
    this.contextKey = ctxKey;
    this.handle = handle;
    this.subscribers = subscribers;
  }

  protected render(
    props: VNodeProps,
  ): Generator<OptionalUpdateResult, ReconcileResult, BaseInstance> {
    const newValue = props!["value"];
    if (!Object.is(this.handle.ref.current, newValue)) {
      this.handle.ref.current = newValue;
      this.notifySubscribers();
    }
    const children = (props["children"] as Child[]) ?? [];
    return reconcile(children, this, this.parentDom, this.endAnchor, "", this.slots, this.keyIndex);
  }

  private notifySubscribers(): void {
    this.rctx.scheduler.beginBatch();
    // Snapshot so a subscriber unsubscribing mid-iteration doesn't skip others.
    for (const callback of this.subscribers) callback();
    this.rctx.scheduler.endBatch();
  }
}
