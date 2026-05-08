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
import type { OptionalDelegationAction, ReconcileResult } from "../reconciler/types";
import { mount } from "../reconciler/mount";
import { $delegateUi } from "../reconciler/utils";
import { HTML_NS } from "../render/elements/namespaces";

const ROOT_VNODE: VNode<typeof Fragment> = { type: Fragment, props: {}, children: [] };

export class RootInstance extends BaseInstance<typeof Fragment> {
  private pendingVNode: VNode | undefined;
  constructor(rctx: RenderContext) {
    super("root", ROOT_VNODE, new Map(), null, rctx, rctx.container, HTML_NS);
  }
  protected override *render(): Generator<OptionalDelegationAction, ReconcileResult, BaseInstance> {
    if (!this.pendingVNode) return { slots: [], keyIndex: new Map() };
    const stagingDom = document.createDocumentFragment();
    const result = yield* mount([this.pendingVNode], this, this.parentDom, stagingDom, "", this.ns);
    yield $delegateUi(() => this.parentDom.appendChild(stagingDom));
    return result;
  }

  run(vnode: VNode) {
    this.pendingVNode = vnode;
    const gen = this.apply();
    let result = gen.next();
    while (!result.done) result = gen.next();
    this.updateDOM();
  }

  debugLabel(): string {
    return "<Root>";
  }
}
