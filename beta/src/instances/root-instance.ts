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
import type { OptionalDelegationAction } from "../reconciler/delegation";
import { deferUi } from "../reconciler/delegation";
import { HTML_NS } from "../render/elements/namespaces";
import type { ComponentSlotType, ContextSlotType, FragmentSlotType, Slot } from "../slots/slot";
import { mountRoot } from "../reconciler/reconciler";

const ROOT_VNODE: VNode<FragmentSlotType> = { type: Fragment, props: { children: [] } };

export class RootInstance extends BaseInstance<ContextSlotType> {
  private pendingVNode: VNode | undefined = undefined;
  constructor(rctx: RenderContext) {
    const headNode = document.createComment("<Root>");
    const tailNode = document.createComment("</Root>");
    super(
      headNode,
      tailNode,
      "root",
      ROOT_VNODE as any,
      new Map(),
      null,
      rctx,
      rctx.container,
      HTML_NS,
    );
  }
  protected override *render(): Generator<
    OptionalDelegationAction,
    Slot,
    Slot<ComponentSlotType | ContextSlotType>
  > {
    const stagingDom = document.createDocumentFragment();
    const slot = yield* mountRoot(this.pendingVNode, this, this.parentDom, stagingDom, this.ns);
    yield deferUi(() => this.parentDom.appendChild(stagingDom));
    return slot;
  }

  run(vnode: VNode) {
    this.pendingVNode = vnode;
    const gen = this.apply();
    let result = gen.next();
    while (!result.done) result = gen.next();
    this.updateDOM();
  }
}
