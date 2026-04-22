/**
 * A **Slot** tracks one reconciled position in the rendered DOM tree.
 *
 * Every DOM child produced by the renderer has a corresponding Slot.
 * Slots form a parallel tree that the reconciler uses to diff old output
 * against new VNodes.
 */

import type { Component, VNodeProps } from "../jsx";
import type { DelegationRoot } from "./delegation";
import type { RefLike } from "./element-props";
import { applyElementProps } from "./element-props";
import type { BaseInstance } from "../instances/base-instance";
import type { Context } from "yract-beta";

export type SlotKey = string | number;
export type SlotPath = string;

// ---------------------------------------------------------------------------
// Slot type constants
// ---------------------------------------------------------------------------

export const emptySlotType = "yract-empty" as const;
export type EmptySlotType = typeof emptySlotType;

export const textSlotType = "yract-text" as const;
export type TextSlotType = typeof textSlotType;

export const elementSlotType = "yract-element" as const;
export type ElementSlotType = typeof elementSlotType;

export const fragmentSlotType = "yract-fragment" as const;
export type FragmentSlotType = typeof fragmentSlotType;

export const componentSlotType = "yract-component" as const;
export type ComponentSlotType = typeof componentSlotType;

export const contextSlotType = "yract-context" as const;
export type ContextSlotType = typeof contextSlotType;

// ---------------------------------------------------------------------------
// Slot interfaces
// ---------------------------------------------------------------------------

export interface EmptySlot {
  /** position in parent's slot list */
  index: number;
  node: Text;
  type: EmptySlotType;
  /**
   * Path to this slot in the render tree, as an array of `SlotKey`
   * (`key` when the child VNode has one, falling back to the positional
   * index). Computed by the reconciler on build / update and stable across
   * renders as long as `key` / index don't change.
   */
  slotPath: SlotPath;
}

export interface TextSlot extends Omit<EmptySlot, "type"> {
  type: TextSlotType;
  props: string;
}

export interface ElementSlot extends Omit<TextSlot, "type" | "props" | "node"> {
  node: HTMLElement;
  key: SlotKey;
  slots: Slot[];
  /** Pre-built key index for this slot's children, ready for the next reconcile. */
  keyIndex?: Map<SlotKey, number>;
  /**
   * The props object at last render.
   *
   * Used by the reconciler for shallow-equality memoization: if the new
   * VNode has the same type and `shallowEqual(prevSlot.props, newProps)`,
   * the component is skipped (no rerender).
   */
  props: VNodeProps & { ref?: RefLike };
  type: ElementSlotType;
  element: string;
}

export interface FragmentSlot extends Omit<ElementSlot, "type" | "element" | "node"> {
  node: Comment;
  type: FragmentSlotType;
  props: VNodeProps;
  /** End-of-range marker so the reconciler can move/remove the fragment as a unit. */
  endAnchor: Node;
  keyIndex?: Map<SlotKey, number>;
}

export interface ComponentSlot extends Omit<ElementSlot, "type" | "element" | "node"> {
  node: Comment;
  instance: BaseInstance<Component>;
  type: ComponentSlotType;
  keyIndex?: Map<SlotKey, number>;
}

export interface ContextSlot extends Omit<ElementSlot, "type" | "element" | "props" | "node"> {
  node: Comment;
  instance: BaseInstance<Context>;
  props: VNodeProps;
  type: ContextSlotType;
  keyIndex?: Map<SlotKey, number>;
}

export type Slot = EmptySlot | TextSlot | ElementSlot | FragmentSlot | ComponentSlot | ContextSlot;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isEmptySlot(slot: Slot): slot is EmptySlot {
  return slot.type === emptySlotType;
}

export function isTextSlot(slot: Slot): slot is TextSlot {
  return slot.type === textSlotType;
}

export function isElementSlot(slot: Slot): slot is ElementSlot {
  return slot.type === elementSlotType;
}

export function isFragmentSlot(slot: Slot): slot is FragmentSlot {
  return slot.type === fragmentSlotType;
}

export function isComponentSlot(slot: Slot): slot is ComponentSlot {
  return slot.type === componentSlotType;
}

export function isContextSlot(slot: Slot): slot is ContextSlot {
  return slot.type === contextSlotType;
}

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

export function getSlotKey(slot: Slot): SlotKey {
  if (slot.type === emptySlotType || slot.type === textSlotType) return slot.index;
  return slot.key;
}

// ---------------------------------------------------------------------------
// Slot constructors
// ---------------------------------------------------------------------------

export function createEmptySlot(index: number, slotPath: SlotPath): EmptySlot {
  const node = document.createTextNode("");
  return { type: emptySlotType, node, index, slotPath };
}

export function createTextSlot(index: number, text: string | number, slotPath: SlotPath): TextSlot {
  const props = String(text);
  const node = document.createTextNode(props);
  return { type: textSlotType, node, props, index, slotPath };
}

export function createElementSlot(
  index: number,
  tag: string,
  props: VNodeProps,
  delegationRoot: DelegationRoot,
  slotPath: SlotPath,
): ElementSlot {
  const el = document.createElement(tag);
  applyElementProps(el, props, delegationRoot);
  const key: SlotKey = props.key ?? index;
  return {
    type: elementSlotType,
    node: el,
    props,
    slots: [],
    key,
    index,
    element: tag,
    slotPath,
  };
}

export function createFragmentSlot(
  index: number,
  props: VNodeProps,
  slotPath: SlotPath,
): FragmentSlot {
  // Fragments use a start/end comment pair so the reconciler can relocate
  // them as a unit. DocumentFragment isn't appropriate here because it
  // becomes empty as soon as it's appended to its parent.
  const node = document.createComment("fragment");
  const endAnchor = document.createComment("/fragment");
  const key: SlotKey = props.key ?? index;
  return {
    type: fragmentSlotType,
    node,
    endAnchor,
    props,
    index,
    key,
    slots: [],
    slotPath,
  };
}
