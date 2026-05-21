import type { Children, VNode, VNodeProps } from "yract-beta";
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
  | TextSlotType
  | ElementSlotType
  | FragmentSlotType
  | ComponentSlotType
  | ContextSlotType;

export type SlotHeadNode<T extends SlotType = SlotType> = T extends TextSlotType
  ? Text
  : T extends ElementSlotType
    ? SlotElement
    : Comment;

export type SlotTailNode<T extends SlotType = SlotType> = T extends TextSlotType
  ? undefined
  : T extends ElementSlotType
    ? undefined
    : Comment;

type SlotInstance<T extends SlotType> = T extends ComponentSlotType | ContextSlotType
  ? BaseInstance
  : undefined;

interface SlotBase<T extends SlotType> {
  child: SlotIntentChild<T>;
  children: Children[];
  headNode: SlotHeadNode<T>;
  index: number;
  instance: SlotInstance<T>;
  key: string;
  move: undefined | boolean;
  path: string;
  props: SlotProps<T>;
  prevProps: SlotProps<T>;
  slots: ReadonlyMap<string, Slot>;
  tailNode: SlotTailNode<T>;
  text: SlotText<T>;
  prevText: SlotText<T>;
  type: T;
}

export interface TextSlot extends SlotBase<TextSlotType> {
  text: string;
}

export type TextChild = string | number | bigint;

export type ElementSlot = SlotBase<ElementSlotType>;

export type ElementChild = VNode<ElementSlotType>;
export type FragmentSlot = SlotBase<FragmentSlotType>;
export type FragmentChild = VNode<FragmentSlotType>;

export type ComponentSlot = SlotBase<ComponentSlotType>;

export type ComponentChild = VNode<ComponentSlotType>;
export type ContextSlot = SlotBase<ContextSlotType>;
export type ContextChild = VNode<ContextSlotType>;

export type EmptySlotTypeToTextSlotType<T extends SlotType | EmptySlotType> =
  T extends EmptySlotType ? TextSlotType : T;

export type Slot<T extends SlotType = SlotType> = T extends TextSlotType
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

export type InstanceSlotNodes = {
  headNode: Comment;
  tailNode: Comment;
};

export type EmptySlotChild = undefined | null | number | boolean | VNode;

export type SlotChild<T extends SlotType | EmptySlotType = SlotType> = T extends EmptySlotType
  ? EmptySlotChild
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

export type SlotIntentChild<T extends SlotType | EmptySlotType> = T extends
  | TextSlotType
  | EmptySlotType
  ? undefined
  : SlotChild<T>;

export type SlotText<T extends SlotType | EmptySlotType> = T extends TextSlotType
  ? string
  : undefined;

export type SlotProps<T extends SlotType | EmptySlotType> = T extends TextSlotType | EmptySlotType
  ? undefined
  : VNodeProps;

export type SlotIntent<T extends SlotType = SlotType> = T extends SlotType
  ? {
      child: SlotIntentChild<T>;
      children: Children[];
      headNode: Node | undefined;
      index: number;
      instance: undefined | BaseInstance;
      key: string;
      move?: boolean;
      path: string;
      props: SlotProps<T>;
      prevProps: undefined | SlotProps<T>;
      slots: ReadonlyMap<string, Slot>;
      tailNode: Node | undefined;
      text: SlotText<T>;
      prevText: SlotText<T> | undefined;
      type: T;
    }
  : never;

export function intentToSlot(
  intent: SlotIntent<TextSlotType>,
  headNode: Text,
): asserts intent is TextSlot;
export function intentToSlot(
  intent: SlotIntent<FragmentSlotType>,
  headNode: Comment,
  tailNode: Comment,
): asserts intent is FragmentSlot;
export function intentToSlot(
  intent: SlotIntent<ElementSlotType>,
  headNode: SlotElement,
): asserts intent is ElementSlot;
export function intentToSlot(
  intent: SlotIntent<ComponentSlotType>,
  headNode: Comment,
  tailNode: Comment,
  instance: BaseInstance,
): asserts intent is ComponentSlot;
export function intentToSlot(
  intent: SlotIntent<ContextSlotType>,
  headNode: Comment,
  tailNode: Comment,
  instance: BaseInstance,
): asserts intent is ContextSlot;
export function intentToSlot(
  intent: SlotIntent,
  headNode: Node,
  tailNode?: Node | undefined,
  instance?: BaseInstance,
): any {
  intent.headNode = headNode;
  intent.tailNode = tailNode;
  intent.instance = instance;
}
