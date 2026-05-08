import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  EmptySlotType,
  FragmentSlotType,
  SlotType,
  TextSlotType,
} from "./type";
import type { Component, Context, VNodeProps } from "yract-beta";
import type { RefLike } from "../render/element-props";
import type { BaseInstance } from "../instances/base-instance";
import type { SlotKey, SlotPath } from "./general";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";

interface SlotBase<T extends SlotType, N> {
  type: T;
  /** position in parent's slot list */
  index: number;
  /**
   * Path to this slot in the render tree, as an array of `SlotKey`
   * (`key` when the child VNode has one, falling back to the positional
   * index). Computed by the reconciler on build / update and stable across
   * renders as long as `key` / index don't change.
   */
  slotPath: SlotPath;
  node: N;
}
export interface EmptySlot extends SlotBase<EmptySlotType, Text> {}

export interface TextSlot extends SlotBase<TextSlotType, Text> {
  props: string;
}

interface ParentSlotBase<T extends SlotType, N> extends SlotBase<T, N> {
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
  props: VNodeProps;
}
export interface ElementSlot extends ParentSlotBase<ElementSlotType, SlotElement> {
  ns: TagNamespace;
  props: VNodeProps & { ref?: RefLike };
  element: string;
}

export interface FragmentSlot extends ParentSlotBase<FragmentSlotType, Comment> {
  /** End-of-range marker so the reconciler can move/remove the fragment as a unit. */
  endAnchor: Node;
}

export interface ComponentSlot extends ParentSlotBase<ComponentSlotType, Comment> {
  instance: BaseInstance<Component>;
}

export interface ContextSlot extends ParentSlotBase<ContextSlotType, Comment> {
  instance: BaseInstance<Context>;
}

export type Slot = EmptySlot | TextSlot | ElementSlot | FragmentSlot | ComponentSlot | ContextSlot;
