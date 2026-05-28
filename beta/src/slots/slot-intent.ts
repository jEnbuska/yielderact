import type { Children } from "../jsx";
import type {
  FragmentSlotType,
  SlotChildren,
  SlotComponent,
  SlotContext,
  SlotDeps,
  SlotElement,
  SlotHeadNode,
  SlotInstance,
  SlotProps,
  SlotSlots,
  SlotTailNode,
  SlotText,
  SlotType,
} from "./slot";
import { fragmentSlotType, textSlotType, type TextSlotType } from "./slot";

export type SlotIntent<T extends SlotType = SlotType> = T extends SlotType
  ? {
      children: SlotChildren<T>;
      component: SlotComponent<T>;
      context: SlotContext<T>;
      deps: SlotDeps<T>;
      element: SlotElement<T>;
      headNode: SlotHeadNode<T> | undefined;
      index: number;
      instance: SlotInstance<T>;
      key: string;
      move: boolean | undefined;
      path: string;
      prevProps: undefined | SlotProps<T>;
      prevText: SlotText<T> | undefined;
      props: SlotProps<T>;
      slots: SlotSlots<T> | undefined;
      tailNode: SlotTailNode<T> | undefined;
      text: SlotText<T>;
      type: T;
    }
  : never;
export function asFragmentIntent(
  children: ReadonlyArray<Children>,
  key: string,
  index: number,
  parentPath: string,
): SlotIntent<FragmentSlotType> {
  return {
    children,
    component: undefined,
    context: undefined,
    deps: undefined,
    element: undefined,
    headNode: undefined,
    index,
    instance: undefined,
    key,
    move: undefined,
    path: createSlotPath(key, parentPath),
    prevProps: undefined,
    prevText: undefined,
    props: undefined,
    slots: undefined,
    tailNode: undefined,
    text: undefined,
    type: fragmentSlotType,
  };
}

export function asTextIntent(
  text: string,
  index: number,
  key: string,
  parentPath: string,
): SlotIntent<TextSlotType> {
  return {
    children: undefined,
    component: undefined,
    context: undefined,
    deps: undefined,
    element: undefined,
    headNode: undefined,
    index,
    instance: undefined,
    key,
    move: undefined,
    path: createSlotPath(key, parentPath),
    prevProps: undefined,
    prevText: undefined,
    props: undefined,
    slots: undefined,
    tailNode: undefined,
    text,
    type: textSlotType,
  };
}

export const emptyChildren: ReadonlyArray<Children> = [];

export function getIntentChildren(children: Children): ReadonlyArray<Children> {
  if (Array.isArray(children)) return children;
  if (children === undefined) return emptyChildren;
  return [children];
}

function createSlotPath(key: string, parentPath: string) {
  return `${parentPath}/${key}`;
}
