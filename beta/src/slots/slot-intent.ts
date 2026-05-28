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
import {
  type ComponentSlotType,
  type ContextSlotType,
  createSlotPath,
  type ElementSlotType,
  fragmentSlotType,
  textSlotType,
  type TextSlotType,
} from "./slot";
import type { DraftIntent } from "./intent-draft";

export type SlotIntent<T extends SlotType = SlotType> = T extends SlotType
  ? {
      _key: string | undefined;
      children: SlotChildren<T>;
      component: SlotComponent<T>;
      context: SlotContext<T>;
      deps: SlotDeps<T>;
      element: SlotElement<T>;
      headNode: SlotHeadNode<T> | undefined;
      index: number;
      instance: SlotInstance<T>;
      key: string;
      stable: boolean | undefined;
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

export function arrayAsFragmentIntent(
  children: ReadonlyArray<Children>,
  key: string,
  index: number,
  parentPath: string,
): SlotIntent<FragmentSlotType> {
  return {
    _key: undefined,
    children,
    component: undefined,
    context: undefined,
    deps: undefined,
    element: undefined,
    headNode: undefined,
    index,
    instance: undefined,
    key,
    stable: undefined,
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
    _key: undefined,
    children: undefined,
    component: undefined,
    context: undefined,
    deps: undefined,
    element: undefined,
    headNode: undefined,
    index,
    instance: undefined,
    key,
    stable: undefined,
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
export function draftToIntent(
  draft: DraftIntent<ComponentSlotType>,
  key: string,
  index: number,
  parentPath: string,
): SlotIntent<ComponentSlotType>;
export function draftToIntent(
  draft: DraftIntent<ContextSlotType>,
  key: string,
  index: number,
  parentPath: string,
): SlotIntent<ContextSlotType>;
export function draftToIntent(
  draft: DraftIntent<ElementSlotType>,
  key: string,
  index: number,
  parentPath: string,
): SlotIntent<ElementSlotType>;
export function draftToIntent(
  draft: DraftIntent<FragmentSlotType>,
  key: string,
  index: number,
  parentPath: string,
): SlotIntent<FragmentSlotType>;
export function draftToIntent(draft: DraftIntent, key: string, index: number, parentPath: string) {
  const same = draft as any as SlotIntent;
  same.key = key;
  same.path = `${parentPath}/${key}`;
  same.index = index;
  return same;
}
