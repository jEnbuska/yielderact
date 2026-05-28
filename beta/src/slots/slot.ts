import type { ComponentFiber } from "../instances/component-fiber";
import type { AnyElement } from "../render/elements/namespaces";
import type { Children, Component } from "../jsx";
import type { Context } from "../context";
import type { DependencyList } from "yract-beta";
import type { SlotIntent } from "./slot-intent";
import type { RefLike } from "../render/element-props";
import type { DraftBy } from "../general-types";

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

type SlotBase<T extends SlotType> = T extends SlotType
  ? {
      children: SlotChildren<T>;
      component: SlotComponent<T>;
      context: SlotContext<T>;
      deps: SlotDeps<T>;
      element: SlotElement<T>;
      headNode: SlotHeadNode<T>;
      index: number;
      instance: SlotInstance<T>;
      key: string;
      move: undefined | boolean;
      path: string;
      prevProps: SlotProps<T>;
      prevText: SlotText<T>;
      props: SlotProps<T>;
      slots: SlotSlots<T>;
      tailNode: SlotTailNode<T>;
      text: SlotText<T>;
      type: T;
    }
  : never;

export type SlotJJSXDept<T extends SlotType> = T extends TextSlotType ? undefined : number;
export type SlotSlots<T extends SlotType> = T extends TextSlotType
  ? undefined
  : ReadonlyMap<string, Slot>;

export type SlotHeadNode<T extends SlotType = SlotType> = T extends TextSlotType
  ? Text
  : T extends ElementSlotType
    ? AnyElement
    : Comment;

export type SlotTailNode<T extends SlotType = SlotType> = T extends TextSlotType
  ? undefined
  : T extends ElementSlotType
    ? undefined
    : Comment;

export type SlotInstance<T extends SlotType> = T extends ComponentSlotType | ContextSlotType
  ? ComponentFiber
  : undefined;

export type SlotDeps<T extends SlotType> = T extends ComponentSlotType
  ? DependencyList | undefined
  : undefined;

export type Slot<T extends SlotType = SlotType> = T extends SlotType ? SlotBase<T> : never;

export type SlotElement<T extends SlotType> = T extends ElementSlotType ? string : undefined;

export type SlotText<T extends SlotType> = T extends TextSlotType ? string : undefined;

export type SlotProps<T extends SlotType> = T extends ComponentSlotType | ContextSlotType
  ? Record<string, unknown>
  : T extends ElementSlotType
    ? Record<string, unknown> & { ref?: RefLike }
    : undefined;

export type SlotComponent<T extends SlotType> = T extends ComponentSlotType | ContextSlotType
  ? Component<any>
  : undefined;

export type SlotContext<T extends SlotType> = T extends ContextSlotType
  ? Context
  : T extends ComponentSlotType
    ? Context | undefined
    : undefined;

export type SlotChildren<T extends SlotType> = T extends
  | ComponentSlotType
  | ContextSlotType
  | ElementSlotType
  | FragmentSlotType
  ? ReadonlyArray<Children>
  : undefined;

export function extendIntentWithInstance(
  intent: SlotIntent<ComponentSlotType | ContextSlotType>,
  instance: ComponentFiber,
): asserts intent is Slot<ComponentSlotType> {
  const { headNode, tailNode } = instance;
  intent.headNode = headNode;
  intent.tailNode = tailNode;
  intent.instance = instance;
}

export function extendIntentNodes(
  intent: SlotIntent<ComponentSlotType | ContextSlotType>,
): DraftBy<Slot<ComponentSlotType>, "instance"> {
  const { name } = intent.component;
  intent.headNode = document.createComment(`<${name}>`);
  intent.tailNode = document.createComment(`</${name}>`);
  return intent as DraftBy<Slot<ComponentSlotType>, "instance">;
}
