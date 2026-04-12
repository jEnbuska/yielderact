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
 * `$children` using the extended ctx map.
 */
import { type Context, type ContextHandle, isContext } from "../context";
import type { Child, VNode } from "../jsx";
import { type AnyCallbackResult, applyCallbacks, reconcile } from "../render/reconciler";
import type { ContextMap, RenderContext } from "../render/types";
import { BaseInstance } from "./base-instance";

export class ContextInstance extends BaseInstance<Context> {
  readonly contextKey: Context;
  readonly handle: ContextHandle;
  private subscribers!: Set<() => void>;

  constructor(
    vnode: VNode<Context>,
    parentCtx: ContextMap,
    index: number,
    parent: BaseInstance | null,
    rctx: RenderContext,
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

    super(vnode, extended, index, parent, rctx);
    this.contextKey = ctxKey;
    this.handle = handle;
    this.subscribers = subscribers;
  }

  protected doRender(): void {
    this.applyPendingProps();

    const newValue = this.props["value"];
    if (!Object.is(this.handle.ref.current, newValue)) {
      this.handle.ref.current = newValue;
      this.notifySubscribers();
    }

    const children = this.resolveChildren();

    const parentDom = this.startAnchor.parentNode;
    if (!parentDom) {
      throw new Error("yract-beta: ContextInstance rendered with detached startAnchor");
    }

    const gen = reconcile(children, this, parentDom, this.endAnchor, this.slots, this.keyIndex);
    const callbacks: AnyCallbackResult[] = [];
    let result = gen.next();
    while (!result.done) {
      callbacks.push(result.value);
      result = gen.next();
    }
    const { slots, keyIndex } = result.value;
    this.slots = slots;
    this.keyIndex = keyIndex;
    applyCallbacks(callbacks);
  }

  private notifySubscribers(): void {
    // Snapshot so a subscriber unsubscribing mid-iteration doesn't skip others.
    for (const cb of this.subscribers) cb();
  }

  private resolveChildren(): Child[] {
    const viaProp = this.props["$children"] as Child | Child[] | undefined;
    if (viaProp !== undefined) {
      return Array.isArray(viaProp) ? viaProp : [viaProp];
    }
    return this.vnode.children;
  }
}
