import type { Child, Component, Context, Fragment, VNode, VNodeProps } from "yract-beta";
import type { RefLike } from "../render/element-props";
import type { BaseInstance } from "../instances/base-instance";
import type { SlotElement } from "../render/elements/namespaces";
import { emptyMap } from "../general";

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

export type SlotNodes<T extends SlotType = SlotType> = T extends TextSlotType
  ? [Text]
  : T extends ElementSlotType
    ? [SlotElement]
    : [Comment, Comment];

interface SlotBase<T extends SlotType> {
  action: "";
  move: undefined;
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
  nodes: SlotNodes<T>;
  key: string;
  children: SlotChild<T>;
}

export interface TextSlot extends SlotBase<TextSlotType> {
  text: string;
}

export type TextChild = string | number | bigint;

interface ParentSlotBase<T extends SlotType> extends SlotBase<T> {
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
export interface ElementSlot extends ParentSlotBase<ElementSlotType> {
  props: VNodeProps & { ref?: RefLike };
}

export type ElementChild = VNode<keyof JSX.IntrinsicElements>;

export interface FragmentSlot extends ParentSlotBase<FragmentSlotType> {}

export type FragmentChild = VNode<typeof Fragment>;

export interface ComponentSlot extends ParentSlotBase<ComponentSlotType> {
  instance: BaseInstance<Component>;
}

export type ComponentChild = VNode<Component>;
export interface ContextSlot extends ParentSlotBase<ContextSlotType> {
  instance: BaseInstance<Context>;
}
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

type GenericSlotIntent<
  T extends SlotType,
  TPrev extends undefined | Slot<T>,
  TAction extends "CREATED" | "RENDERED" = "CREATED" | "RENDERED",
> = {
  action: TAction;
  type: T;
  path: "";
  child: T extends TextSlotType | EmptySlotType ? undefined : SlotChild<T>;
  children: Child;
  key: string;
  index: number;
  move: boolean;
  old: TPrev;
  text: T extends TextSlotType ? string : undefined;
  props: T extends TextSlotType | EmptySlotType ? undefined : VNodeProps;
  nodes: unknown[];
  instance: undefined;
  slots: Map<unknown, unknown>;
};

export type DraftSlotIntent<T extends SlotType = SlotType> = GenericSlotIntent<
  T,
  undefined | Slot<T>
>;

export type SlotIntent<T extends SlotType = SlotType> = CreateSlotIntent<T> | RenderSlotIntent<T>;
export type CreateSlotIntent<T extends SlotType = SlotType> = GenericSlotIntent<
  T,
  undefined,
  "CREATED"
>;
export type RenderSlotIntent<T extends SlotType = SlotType> = GenericSlotIntent<
  T,
  Slot<T>,
  "RENDERED"
>;

const emptySlots: Slot[] = [];
export type MakeSlotIntent<T extends SlotType> = Pick<
  DraftSlotIntent<T>,
  "type" | "index" | "key" | "text" | "child" | "props"
>;
export function makeSlot(
  intent: MakeSlotIntent<TextSlotType>,
  path: string,
  nodes: [Text],
): TextSlot;
export function makeSlot(
  intent: MakeSlotIntent<FragmentSlotType>,
  path: string,
  nodes: [Comment, Comment],
  props: VNodeProps,
): FragmentSlot;
export function makeSlot(
  intent: MakeSlotIntent<ElementSlotType>,
  path: string,
  nodes: [SlotElement],
  props: VNodeProps & { ref?: RefLike },
): ElementSlot;
export function makeSlot(
  intent: MakeSlotIntent<ComponentSlotType>,
  path: string,
  nodes: [Comment, Comment],
  props: VNodeProps,
  instance: BaseInstance<Component>,
): ComponentSlot;

export function makeSlot(
  intent: MakeSlotIntent<ContextSlotType>,
  path: string,
  nodes: [Comment, Comment],
  props: VNodeProps,
  instance: BaseInstance<Context>,
): ContextSlot;

export function makeSlot(
  intent: MakeSlotIntent<SlotType>,
  path: string,
  nodes: Node[],
  props?: any,
  instance?: BaseInstance,
) {
  return {
    action: undefined,
    type: intent.type,
    index: intent.index,
    key: intent.key,
    text: intent.text,
    path,
    nodes,
    props,
    instance,
    slots: emptySlots,
  } as any;
}
