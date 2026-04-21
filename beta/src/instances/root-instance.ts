/**
 * RootInstance — synthetic parent for top-level slots under a createRoot().
 *
 * It is a real BaseInstance so the reconciler can uniformly access `ctx`
 * and `rctx` through `parentInstance`, and so unmount cascades via
 * `this.children` also tear down the whole tree. Its `doRender()` is a
 * no-op: the root is driven by `Root.render(vnode)` which calls
 * `reconcileChildren` directly.
 */

import { Fragment, type VNode } from "../jsx";
import type { RenderContext } from "../render/types";
import { BaseInstance } from "./base-instance";
import { reconcile } from "../reconciler/reconciler";
import type { OptionalUpdateResult, ReconcileResult } from "../reconciler/types";
import { invokeUpdates } from "../reconciler/invoke-updates";

const ROOT_VNODE: VNode<typeof Fragment> = { type: Fragment, props: {}, children: [] };

export class RootInstance extends BaseInstance<typeof Fragment> {
  constructor(rctx: RenderContext) {
    super("root", ROOT_VNODE, new Map(), 0, null, rctx, rctx.container);
  }

  protected *render(): Generator<OptionalUpdateResult, ReconcileResult, BaseInstance> {
    return { slots: [], keyIndex: new Map() };
  }

  run(vnode: VNode) {
    const gen = invokeUpdates(
      this,
      reconcile([vnode], this, this.parentDom, null, [], this.slots, this.keyIndex),
    );
    let result = gen.next();
    while (!result.done) result = gen.next();
    this.commitApply(result.value);
    this.applyDomUpdates();
    this.afterAllApplied();
  }

  debugLabel(): string {
    return "<Root>";
  }
}
