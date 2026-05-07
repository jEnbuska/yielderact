import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  EmptySlotType,
  FragmentSlotType,
  TextSlotType,
} from "./type";
import type { Component, Context, VNodeProps } from "yract-beta";
import type { RefLike } from "../render/element-props";
import type { BaseInstance } from "../instances/base-instance";
import type { SlotKey, SlotPath } from "./general";

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
