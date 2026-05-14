import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  EmptySlotType,
  FragmentSlot,
  FragmentSlotType,
  TextSlotType,
} from "./slot";
import {
  type ComponentSlot,
  type ContextSlot,
  type ElementSlot,
  type EmptySlot,
  makeSlot,
  type TextSlot,
} from "./slot";
import type { Component, Context } from "yract-beta";
import type { BaseInstance } from "../instances/base-instance";
import type { DelegationRoot } from "../render/delegation";
import type { TagNamespace } from "../render/elements/namespaces";
import { createElement } from "../render/elements/create";
import { applyElementProps } from "../render/element-props";
import type { DraftIntent } from "../reconciler/prepare";

/**
 * Build a unique slot path string from a parent path and a child key.
 * Positional indices (number) are prefixed with `#`.
 * User-provided string keys are length-prefixed with `$` to avoid
 * collisions with indices and to handle arbitrary string content safely.
 */
export function createSlotPath(parentPath: string, key: string): string {
  return `${parentPath}$${key.length}:${key}`;
}

export function createEmptySlot(
  intent: Pick<DraftIntent<EmptySlotType>, "type" | "index" | "key">,
  path: string,
): EmptySlot {
  const node = document.createTextNode("");
  return makeSlot(intent, path, node);
}

export function createTextSlot(
  intent: Pick<DraftIntent<TextSlotType>, "type" | "index" | "key" | "child">,
  path: string,
): TextSlot {
  const text = String(intent.child);
  const node = document.createTextNode(text);
  return makeSlot(intent, path, node, undefined, text);
}

export function createElementSlot(
  intent: Pick<DraftIntent<ElementSlotType>, "type" | "index" | "key" | "child">,
  delegationRoot: DelegationRoot,
  path: string,
  ns: TagNamespace,
): ElementSlot {
  const { child } = intent;
  const { props } = child;
  const node = createElement(ns, child.type);
  applyElementProps(node, props, delegationRoot);
  return makeSlot(intent, path, node, props);
}

export function createFragmentSlot(
  intent: Pick<DraftIntent<FragmentSlotType>, "type" | "index" | "key" | "child">,
  path: string,
): FragmentSlot {
  // Fragments use a start/end comment pair so the reconciler can relocate
  // them as a unit. DocumentFragment isn't appropriate here because it
  // becomes empty as soon as it's appended to its parent.
  const node = document.createComment("fragment");
  const endAnchor = document.createComment("/fragment");
  return makeSlot(intent, path, node, intent.child.props, undefined, undefined, endAnchor);
}

export function createComponentSlot(
  intent: Pick<DraftIntent<ComponentSlotType>, "type" | "index" | "key" | "child">,
  instance: BaseInstance<Component>,
  path: string,
): ComponentSlot {
  return makeSlot(intent, path, instance.startAnchor, intent.child.props, undefined, instance);
}

export function createContextSlot(
  intent: Pick<DraftIntent<ContextSlotType>, "type" | "index" | "key" | "child">,
  instance: BaseInstance<Context>,
  path: string,
): ContextSlot {
  return makeSlot(intent, path, instance.startAnchor, intent.child.props, undefined, instance);
}
