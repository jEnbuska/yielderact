import type { Child, Component, Context, Fragment, VNode, VNodeProps } from "yract-beta";
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

type SlotInstance<T extends SlotType> = T extends ComponentSlotType
  ? BaseInstance<Component>
  : T extends ContextSlotType
    ? BaseInstance<Context>
    : undefined;

interface SlotBase<T extends SlotType, TAction extends SlotIntentAction = SlotIntentAction> {
  action: TAction;
  child: SlotIntentChild<T>;
  children: Child[];
  headNode: SlotHeadNode<T>;
  index: number;
  instance: SlotInstance<T>;
  key: string;
  move: undefined | boolean;
  path: string;
  props: SlotProps<T>;
  prevProps: SlotProps<T>;
  slots: Map<string, Slot>;
  tailNode: SlotTailNode<T>;
  text: SlotText<T>;
  prevText: SlotText<T>;
  type: T;
}

export interface TextSlot extends SlotBase<TextSlotType> {
  text: string;
}

export type TextChild = string | number | bigint;

export type ElementSlot = SlotBase<ElementSlotType, "RENDERED">;

export type ElementChild = VNode<keyof JSX.IntrinsicElements>;
export type FragmentSlot = SlotBase<FragmentSlotType, "RENDERED">;
export type FragmentChild = VNode<typeof Fragment>;

export type ComponentSlot = SlotBase<ComponentSlotType, "RENDERED">;

export type ComponentChild = VNode<Component>;
export type ContextSlot = SlotBase<ContextSlotType>;
export type ContextChild = VNode<Context>;

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

export type SlotIntentAction = "CREATED" | "RENDERED";

export type SlotIntent<
  T extends SlotType = SlotType,
  TAction extends SlotIntentAction = "CREATED" | "RENDERED",
> = {
  action: TAction;
  child: SlotIntentChild<T>;
  children: Child[];
  headNode: Node | undefined;
  index: number;
  instance: undefined | BaseInstance;
  key: string;
  move?: boolean;
  path: string;
  props: SlotProps<T>;
  prevProps: undefined | SlotProps<T>;
  slots: Map<string, Slot>;
  tailNode: Node | undefined;
  text: SlotText<T>;
  type: T;
};

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
  instance: BaseInstance<Component>,
): asserts intent is ComponentSlot;
export function intentToSlot(
  intent: SlotIntent<ContextSlotType>,
  headNode: Comment,
  tailNode: Comment,
  instance: BaseInstance<Context>,
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
