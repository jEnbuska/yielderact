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
import type { DelegationAction, PropsAction, TextAction } from "./delegation";
import { deferRef, deferText, deferUpdate, delegateProps, isRefProps } from "./delegation";
import { diffElementProps } from "../render/element-props";
import { reconcile } from "./reconciler";

export function updateSlot<T extends SlotType>(
  slot: Slot<T>,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<DelegationAction, void> {
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
): Generator<DelegationAction, void> {
  const { tailNode, children, path, slots } = slot;
  const parentDom = tailNode.parentNode;
  if (!parentDom) {
    throw new Error("yract-beta: fragment slot reconciled with detached start anchor");
  }
  slot.slots = yield* reconcile(children, parentInstance, parentDom, path, slots, ns, tailNode);
}

function* updateElement(
  slot: ElementSlot,
  parentInstance: BaseInstance,
): Generator<DelegationAction, void> {
  const { headNode, children, path, slots, prevProps, props } = slot;
  const ns = nodeNameSpace(headNode);
  slot.slots = yield* reconcile(children, parentInstance, headNode, path, slots, ns, null);
  const patch = diffElementProps(prevProps, props);
  if (isRefProps(slot.props)) {
    yield deferRef(headNode, slot.props.ref);
  }
  if (patch) {
    yield deferUpdate(headNode, patch);
  }
}

function* updateText(slot: TextSlot): Generator<TextAction, void> {
  const { text } = slot;
  if (text === slot.prevText) return;
  yield deferText(slot.headNode, text);
}

function* updateInstance(slot: ContextSlot | ComponentSlot): Generator<PropsAction, void> {
  yield delegateProps(slot.instance, slot.props);
}
