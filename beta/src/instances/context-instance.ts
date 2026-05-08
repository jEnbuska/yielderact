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
import type { ContextMap, RenderContext } from "../render/types";
import { BaseInstance } from "./base-instance";
import type { OptionalDelegationAction, ReconcileResult } from "../reconciler/types";
import type { TagNamespace } from "../render/elements/namespaces";

export class ContextInstance extends BaseInstance<Context> {
  readonly contextKey: Context;
  readonly handle: ContextHandle;
  private readonly subscribers: Set<() => void>;

  constructor(
    childId: string,
    vnode: VNode<Context>,
    parentCtx: ContextMap,
    parent: BaseInstance | null,
    rctx: RenderContext,
    parentDom: Node,
    ns: TagNamespace,
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
      depth: (parent?.depth ?? -1) + 1,
    };

    const extended = new Map(parentCtx);
    extended.set(ctxKey, handle);

    super(childId, vnode, extended, parent, rctx, parentDom, ns);
    this.contextKey = ctxKey;
    this.handle = handle;
    this.subscribers = subscribers;
  }

  private notify = false;

  override *apply() {
    yield* super.apply();
    if (this.notify) {
      this.notifySubscribers();
    }
  }

  protected override render(
    props: VNodeProps,
  ): Generator<OptionalDelegationAction, ReconcileResult, BaseInstance> {
    const newValue = props!["value"];
    if (!Object.is(this.handle.ref.current, newValue)) {
      this.notify = true;
      this.handle.ref.current = newValue;
    }
    const children = (props["children"] as Child[]) ?? [];
    return this.reconcile(children);
  }

  private notifySubscribers(): void {
    this.rctx.scheduler.beginBatch();
    // Snapshot so a subscriber unsubscribing mid-iteration doesn't skip others.
    for (const callback of this.subscribers) callback();
    this.rctx.scheduler.endBatch();
  }
}
