import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  FragmentSlot,
  FragmentSlotType,
  SlotIntent,
  TextSlotType,
} from "./slot";
import {
  type ComponentSlot,
  type ContextSlot,
  type ElementSlot,
  intentToSlot,
  type TextSlot,
} from "./slot";
import type { Component, Context } from "yract-beta";
import type { BaseInstance } from "../instances/base-instance";
import type { DelegationRoot } from "../render/delegation";
import type { TagNamespace } from "../render/elements/namespaces";
import { createElement } from "../render/elements/create";
import { applyElementProps } from "../render/element-props";

export function toTextSlot(intent: SlotIntent<TextSlotType>): asserts intent is TextSlot {
  const text = intent.text;
  intentToSlot(intent, document.createTextNode(text));
}

export function toElementSlot(
  intent: SlotIntent<ElementSlotType>,
  delegationRoot: DelegationRoot,
  ns: TagNamespace,
): asserts intent is ElementSlot {
  const { child } = intent;
  const { props } = child;
  const node = createElement(ns, child.type);
  applyElementProps(node, props, delegationRoot);
  intentToSlot(intent, node);
}

export function toFragmentSlot(
  intent: SlotIntent<FragmentSlotType>,
): asserts intent is FragmentSlot {
  intentToSlot(intent, document.createComment("fragment"), document.createComment("/fragment"));
}

export function toComponentSlot(
  intent: SlotIntent<ComponentSlotType>,
  instance: BaseInstance<Component>,
): asserts intent is ComponentSlot {
  intentToSlot(intent, instance.startAnchor, instance.endAnchor, instance);
}

export function toContextSlot(
  intent: SlotIntent<ContextSlotType>,
  instance: BaseInstance<Context>,
): asserts intent is ContextSlot {
  intentToSlot(intent, instance.startAnchor, instance.endAnchor, instance);
}
