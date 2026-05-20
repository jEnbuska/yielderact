import type { ComponentSlot, ContextSlot, Slot, SlotType, TextSlot } from "../slots/slot";
import {
  componentSlotType,
  contextSlotType,
  type ElementSlot,
  elementSlotType,
  type FragmentSlotType,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";
import type { BaseInstance } from "../instances/base-instance";
import type { TagNamespace } from "../render/elements/namespaces";
import { nodeNameSpace } from "../render/elements/namespaces";
import type { OptionalDelegationAction } from "./types";
import { delegateProps, delegateRef, delegateUi, isRefProps } from "./delegation";
import { stage } from "../general";
import { setText } from "./dom-updates";
import { diffElementProps, updateElementProps } from "../render/element-props";
import { reconcile } from "./reconciler";

export function updateSlot<T extends SlotType>(
  slot: Slot<T>,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, void> {
  switch (slot.type) {
    case componentSlotType:
    case contextSlotType:
      return updateInstance(slot);
    case textSlotType:
      return updateText(slot);
    case elementSlotType:
      return updateElement(slot, parentInstance);
    case fragmentSlotType:
      return updateFragment(slot, parentInstance, ns);
    default:
      throw new Error(`Unhandled update slot ${slot satisfies never}`);
  }
}

function* updateFragment(
  slot: Slot<FragmentSlotType>,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, void> {
  const { headNode, tailNode } = slot;
  const parentDom = headNode.parentNode;
  if (!parentDom) {
    throw new Error("yract-beta: fragment slot reconciled with detached start anchor");
  }
  slot.slots = yield* reconcile(
    slot.children,
    parentInstance,
    parentDom,
    slot.path,
    slot.slots,
    ns,
    tailNode,
  );
}

function* updateElement(
  slot: ElementSlot,
  parentInstance: BaseInstance,
): Generator<OptionalDelegationAction, void> {
  const node = slot.headNode;
  slot.slots = yield* reconcile(
    slot.children,
    parentInstance,
    node,
    slot.path,
    slot.slots,
    nodeNameSpace(node),
    null,
  );
  const patch = diffElementProps(slot.prevProps, slot.props);
  if (isRefProps(slot.props)) {
    yield delegateRef(node, slot.props.ref);
  }
  if (patch) {
    yield delegateUi(stage(updateElementProps, node, patch, parentInstance.rctx.delegationRoot));
  }
}

function* updateText(slot: TextSlot): Generator<OptionalDelegationAction, void> {
  const { text } = slot;
  if (text === slot.prevText) return;
  yield delegateUi(stage(setText, slot.headNode, text));
}

function* updateInstance(slot: ContextSlot | ComponentSlot) {
  yield delegateProps(slot.instance, slot.child);
}
