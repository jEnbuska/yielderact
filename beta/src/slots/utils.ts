import type { ElementSlotType, FragmentSlotType, Slot, TextSlotType } from "./slot";
import { elementSlotType, fragmentSlotType, textSlotType } from "./slot";
import type { DelegationRoot } from "../render/delegation";
import type { TagNamespace } from "../render/elements/namespaces";
import { createElement } from "../render/elements/create";
import { applyElementProps, diffElementProps, updateElementProps } from "../render/element-props";
import type { Intent } from "./intent";
import type { DraftBy } from "../general-types";

export function updateWithPreparedSlot(
  intent: Intent<ElementSlotType | TextSlotType | FragmentSlotType>,
  prev: Slot,
  delegationRoot: DelegationRoot,
): Slot<ElementSlotType | TextSlotType | FragmentSlotType> {
  switch (intent.type) {
    case elementSlotType:
      return inheritElementSlot(intent, prev as Slot<ElementSlotType>, delegationRoot);
    case textSlotType:
      return inheritTextSlot(intent, prev as Slot<TextSlotType>);
    case fragmentSlotType:
      return inheritFragmentSlot(intent, prev as Slot<FragmentSlotType>);
    default:
      throw new Error(`Invalid slot ${JSON.stringify(intent satisfies never)}`);
  }
}

function inheritElementSlot(
  intent: Intent<ElementSlotType>,
  prev: Slot<ElementSlotType>,
  delegationRoot: DelegationRoot,
): Slot<ElementSlotType> {
  const { headNode } = prev;
  intent.headNode = headNode;
  const patch = diffElementProps(prev, intent.props);
  if (patch) {
    updateElementProps(headNode, patch, delegationRoot);
  }
  return intent satisfies DraftBy<
    Slot<ElementSlotType>,
    "headNode" | "tailNode" | "slots" | "prevProps"
  > as Slot<ElementSlotType>;
}
function inheritFragmentSlot(
  intent: Intent<FragmentSlotType>,
  prev: Slot<FragmentSlotType>,
): Slot<FragmentSlotType> {
  intent.headNode = prev.headNode;
  intent.tailNode = prev.tailNode;
  return intent as Slot<FragmentSlotType>;
}

function inheritTextSlot(
  intent: Intent<TextSlotType>,
  prev: Slot<TextSlotType>,
): Slot<TextSlotType> {
  const { headNode } = prev;
  intent.headNode = prev.headNode;
  const { text } = intent;
  if (prev.text !== text) {
    headNode.nodeValue = text;
  }
  return intent satisfies DraftBy<
    Slot<TextSlotType>,
    "headNode" | "prevText"
  > as Slot<TextSlotType>;
}

export function prepareSlotNodes(
  intent: Intent<ElementSlotType | TextSlotType | FragmentSlotType>,
  delegationRoot: DelegationRoot,
  ns: TagNamespace | undefined,
): Slot<ElementSlotType | TextSlotType | FragmentSlotType> {
  switch (intent.type) {
    case elementSlotType:
      return toElementSlot(intent, delegationRoot, ns!);
    case textSlotType:
      return toTextSlot(intent);
    case fragmentSlotType:
      return toFragmentSlot(intent);
    default:
      throw new Error(`Invalid CREATE kind ${JSON.stringify(intent satisfies never)}`);
  }
}

function toTextSlot(intent: Intent<TextSlotType>): Slot<TextSlotType> {
  const text = intent.text;
  intent.headNode = document.createTextNode(text);
  return intent satisfies DraftBy<
    Slot<TextSlotType>,
    "headNode" | "prevText"
  > as Slot<TextSlotType>;
}

function toElementSlot(
  intent: Intent<ElementSlotType>,
  delegationRoot: DelegationRoot,
  ns: TagNamespace,
): Slot<ElementSlotType> {
  const { element, props } = intent;
  const node = createElement(ns, element);
  applyElementProps(node, props, delegationRoot);
  intent.headNode = node;
  return intent as Slot<ElementSlotType>;
}

function toFragmentSlot(intent: Intent<FragmentSlotType>): Slot<FragmentSlotType> {
  intent.headNode = document.createComment("<Fragment>");
  intent.tailNode = document.createComment("</Fragment>");
  return intent satisfies DraftBy<
    Intent<FragmentSlotType>,
    "headNode" | "tailNode"
  > as Slot<FragmentSlotType>;
}
