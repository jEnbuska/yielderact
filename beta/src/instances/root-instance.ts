import { Fragment, type VNode } from "../jsx";
import type { RenderContext } from "../render/types";
import { BaseInstance } from "./base-instance";
import type { DelegationAction } from "../reconciler/delegation";
import { deferInsert } from "../reconciler/delegation";
import { nodeNameSpace } from "../render/elements/namespaces";
import type { ComponentSlotType, ContextSlotType, FragmentSlotType, Slot } from "../slots/slot";
import { mountRoot } from "../reconciler/reconciler";
import { insertBefore } from "../reconciler/dom-updates";

const ROOT_VNODE: VNode<FragmentSlotType> = { type: Fragment, props: { children: [] } };

export class RootInstance extends BaseInstance<ContextSlotType> {
  private pendingVNode: VNode | undefined = undefined;
  constructor(rctx: RenderContext) {
    const headNode = document.createComment("<Root>");
    const tailNode = document.createComment("</Root>");
    const ns = nodeNameSpace(rctx.container);
    super(headNode, tailNode, "root", ROOT_VNODE as any, new Map(), null, rctx, rctx.container, ns);
  }
  protected override *render(): Generator<
    DelegationAction,
    Slot,
    Slot<ComponentSlotType | ContextSlotType>
  > {
    const stagingDom = document.createDocumentFragment();
    const slot = yield* mountRoot(this.pendingVNode, this, this.parentDom, stagingDom, this.ns);
    yield deferInsert(this.parentDom, stagingDom, null);
    return slot;
  }

  run(vnode: VNode) {
    this.pendingVNode = vnode;
    this.apply();
    for (const change of this.domActions!) {
      if (change.type === "INSERT") {
        const { before, parentDom, node } = change;
        insertBefore(parentDom, node, before);
      }
    }
    this.domActions = undefined;
    this.slot = this.pendingSlots;
  }
}
