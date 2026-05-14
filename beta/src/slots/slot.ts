import type { Component, Context, Fragment, VNode, VNodeProps } from "yract-beta";
import type { RefLike } from "../render/element-props";
import type { BaseInstance } from "../instances/base-instance";
import type { SlotElement } from "../render/elements/namespaces";
import type { DraftIntent } from "../reconciler/prepare";

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
export type SlotType =
  | EmptySlotType
  | TextSlotType
  | ElementSlotType
  | FragmentSlotType
  | ComponentSlotType
  | ContextSlotType;

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
  path: string;
  node: N;
  key: string;
}
export interface EmptySlot extends SlotBase<EmptySlotType, Text> {}

export interface TextSlot extends SlotBase<TextSlotType, Text> {
  text: string;
}

export type TextChild = string | number;

interface ParentSlotBase<T extends SlotType, N> extends SlotBase<T, N> {
  slots: Slot[];
  /** Pre-built key index for this slot's children, ready for the next reconcile. */
  keyIndex?: Map<string, number>;
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
  props: VNodeProps & { ref?: RefLike };
}

export type ElementChild = VNode<keyof JSX.IntrinsicElements>;

export interface FragmentSlot extends ParentSlotBase<FragmentSlotType, Comment> {
  /** End-of-range marker so the reconciler can move/remove the fragment as a unit. */
  endAnchor: Comment;
}

export type FragmentChild = VNode<typeof Fragment>;

export interface ComponentSlot extends ParentSlotBase<ComponentSlotType, Comment> {
  instance: BaseInstance<Component>;
}

export type ComponentChild = VNode<Component>;
export interface ContextSlot extends ParentSlotBase<ContextSlotType, Comment> {
  instance: BaseInstance<Context>;
}
export type ContextChild = VNode<Context>;

export type Slot<T extends SlotType = SlotType> = T extends EmptySlotType
  ? EmptySlot
  : T extends TextSlotType
    ? TextSlot
    : T extends ElementSlotType
      ? ElementSlot
      : T extends FragmentSlotType
        ? FragmentSlot
        : T extends ComponentSlotType
          ? ComponentSlot
          : T extends ContextSlotType
            ? ContextSlot
            : never;

export type SlotChild<T extends SlotType = SlotType> = T extends EmptySlotType
  ? undefined | null | number | boolean | VNode
  : T extends TextSlotType
    ? TextChild
    : T extends ElementSlotType
      ? ElementChild
      : T extends FragmentSlotType
        ? FragmentChild
        : T extends ComponentSlotType
          ? ComponentChild
          : T extends ContextSlotType
            ? ContextChild
            : never;

const emptySlots: Slot[] = [];
export type MakeSlotDraft<T extends SlotType> = Pick<DraftIntent<T>, "type" | "index" | "key">;
export function makeSlot(intent: MakeSlotDraft<EmptySlotType>, path: string, node: Text): EmptySlot;
export function makeSlot(
  intent: MakeSlotDraft<TextSlotType>,
  path: string,
  node: Text,
  props: undefined,
  text: string,
): TextSlot;
export function makeSlot(
  intent: MakeSlotDraft<FragmentSlotType>,
  path: string,
  node: Comment,
  props: VNodeProps,
  text: undefined,
  instance: undefined,
  endAnchor: Node,
): FragmentSlot;
export function makeSlot(
  intent: MakeSlotDraft<ElementSlotType>,
  path: string,
  node: SlotElement,
  props: VNodeProps & { ref?: RefLike },
): ElementSlot;
export function makeSlot(
  intent: MakeSlotDraft<ComponentSlotType>,
  path: string,
  node: Comment,
  props: VNodeProps,
  text: undefined,
  instance: BaseInstance<Component>,
): ComponentSlot;

export function makeSlot(
  intent: MakeSlotDraft<ContextSlotType>,
  path: string,
  node: Comment,
  props: VNodeProps,
  text: undefined,
  instance: BaseInstance<Context>,
): ContextSlot;

export function makeSlot(
  intent: MakeSlotDraft<SlotType>,
  path: string,
  node: any,
  props?: any,
  text?: string,
  instance?: any,
  endAnchor?: any,
) {
  return {
    type: intent.type,
    index: intent.index,
    key: intent.key,
    path,
    node,
    props,
    text,
    instance,
    endAnchor,
    slots: emptySlots,
    keyIndex: undefined,
  } as any;
}
