import type { ElementSlotType, FragmentSlotType, Slot, TextSlotType } from "./slot";
import { intentToSlot } from "./slot";
import type { DelegationRoot } from "../render/delegation";
import type { TagNamespace } from "../render/elements/namespaces";
import { createElement } from "../render/elements/create";
import { applyElementProps } from "../render/element-props";
import type { SlotIntent } from "./slot-intent";

export function toTextSlot(intent: SlotIntent<TextSlotType>): asserts intent is Slot<TextSlotType> {
  const text = intent.text;
  intentToSlot(intent, document.createTextNode(text));
}

export function toElementSlot(
  intent: SlotIntent<ElementSlotType>,
  delegationRoot: DelegationRoot,
  ns: TagNamespace,
): asserts intent is Slot<ElementSlotType> {
  const { element, props } = intent;
  const node = createElement(ns, element);
  applyElementProps(node, props, delegationRoot);
  intentToSlot(intent, node);
}

export function toFragmentSlot(
  intent: SlotIntent<FragmentSlotType>,
): asserts intent is Slot<FragmentSlotType> {
  intentToSlot(intent, document.createComment("<Fragment>"), document.createComment("</Fragment>"));
}
