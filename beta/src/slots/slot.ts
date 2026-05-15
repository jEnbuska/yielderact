import type { Child, Component, Context, Fragment, VNode, VNodeProps } from "yract-beta";
import type { RefLike } from "../render/element-props";
import type { BaseInstance } from "../instances/base-instance";
import type { SlotElement } from "../render/elements/namespaces";

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
  slots: Map<string, Slot>;
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

type GenericSlotIntent<
  TAction extends string,
  T extends SlotType,
  TPrev extends undefined | Slot<T>,
> = {
  action: TAction;
  type: T;
  child: T extends TextSlotType | EmptySlotType ? undefined : SlotChild<T>;
  children: Child[];
  key: string;
  index: number;
  move: boolean;
  prev: TPrev;
  nextKey: undefined | string;
  text: T extends TextSlotType ? string : undefined;
  props: T extends TextSlotType | EmptySlotType ? undefined : VNodeProps;
};

export type DraftSlotIntent<T extends SlotType = SlotType> = GenericSlotIntent<string, T, any>;

export type SlotIntent<T extends SlotType = SlotType> = CreateSlotIntent<T> | RenderSlotIntent<T>;
export type CreateSlotIntent<T extends SlotType = SlotType> = GenericSlotIntent<
  "CREATED",
  T,
  undefined
>;
export type RenderSlotIntent<T extends SlotType = SlotType> = GenericSlotIntent<
  "RENDERED",
  T,
  Slot<T>
>;

const emptySlots: Slot[] = [];
export type MakeSlotIntent<T extends SlotType> = Pick<
  DraftSlotIntent<T>,
  "type" | "index" | "key" | "text" | "child" | "props"
>;
export function makeSlot(
  intent: MakeSlotIntent<EmptySlotType>,
  path: string,
  node: Text,
): EmptySlot;
export function makeSlot(
  intent: MakeSlotIntent<TextSlotType>,
  path: string,
  node: Text,
  props: undefined,
): TextSlot;
export function makeSlot(
  intent: MakeSlotIntent<FragmentSlotType>,
  path: string,
  node: Comment,
  props: VNodeProps,
  instance: undefined,
  endAnchor: Node,
): FragmentSlot;
export function makeSlot(
  intent: MakeSlotIntent<ElementSlotType>,
  path: string,
  node: SlotElement,
  props: VNodeProps & { ref?: RefLike },
): ElementSlot;
export function makeSlot(
  intent: MakeSlotIntent<ComponentSlotType>,
  path: string,
  node: Comment,
  props: VNodeProps,
  instance: BaseInstance<Component>,
): ComponentSlot;

export function makeSlot(
  intent: MakeSlotIntent<ContextSlotType>,
  path: string,
  node: Comment,
  props: VNodeProps,
  instance: BaseInstance<Context>,
): ContextSlot;

export function makeSlot(
  intent: MakeSlotIntent<SlotType>,
  path: string,
  node: any,
  props?: any,
  instance?: any,
  endAnchor?: any,
) {
  return {
    type: intent.type,
    index: intent.index,
    key: intent.key,
    text: intent.text,
    path,
    node,
    props,
    instance,
    endAnchor,
    slots: emptySlots,
    keyIndex: undefined,
  } as any;
}
