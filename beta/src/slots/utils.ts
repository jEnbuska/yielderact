import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  FragmentSlot,
  FragmentSlotType,
  MakeSlotIntent,
  TextSlotType,
} from "./slot";
import {
  type ComponentSlot,
  type ContextSlot,
  type ElementSlot,
  makeSlot,
  type TextSlot,
} from "./slot";
import type { Component, Context } from "yract-beta";
import type { BaseInstance } from "../instances/base-instance";
import type { DelegationRoot } from "../render/delegation";
import type { TagNamespace } from "../render/elements/namespaces";
import { createElement } from "../render/elements/create";
import { applyElementProps } from "../render/element-props";

/**
 * Build a unique slot path string from a parent path and a child key.
 * Positional indices (number) are prefixed with `#`.
 * User-provided string keys are length-prefixed with `$` to avoid
 * collisions with indices and to handle arbitrary string content safely.
 */
export function createSlotPath(parentPath: string, key: string): string {
  return `${parentPath}$${key.length}:${key}`;
}

export function createTextSlot(intent: MakeSlotIntent<TextSlotType>, path: string): TextSlot {
  const text = intent.text;
  return makeSlot(intent, path, [document.createTextNode(text)]);
}

export function createElementSlot(
  intent: MakeSlotIntent<ElementSlotType>,
  delegationRoot: DelegationRoot,
  path: string,
  ns: TagNamespace,
): ElementSlot {
  const { child } = intent;
  const { props } = child;
  const node = createElement(ns, child.type);
  applyElementProps(node, props, delegationRoot);
  return makeSlot(intent, path, [node], props);
}

export function createFragmentSlot(
  intent: MakeSlotIntent<FragmentSlotType>,
  path: string,
): FragmentSlot {
  return makeSlot(
    intent,
    path,
    [document.createComment("fragment"), document.createComment("/fragment")],
    intent.props,
  );
}

export function createComponentSlot(
  intent: MakeSlotIntent<ComponentSlotType>,
  instance: BaseInstance<Component>,
  path: string,
): ComponentSlot {
  return makeSlot(intent, path, [instance.startAnchor, instance.endAnchor], intent.props, instance);
}

export function createContextSlot(
  intent: MakeSlotIntent<ContextSlotType>,
  instance: BaseInstance<Context>,
  path: string,
): ContextSlot {
  return makeSlot(intent, path, [instance.startAnchor, instance.endAnchor], intent.props, instance);
}
