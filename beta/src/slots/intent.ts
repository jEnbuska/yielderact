import type { Child, Children } from "../jsx";
import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  FragmentSlotType,
  Slot,
  SlotChildren,
  SlotComponent,
  SlotContext,
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
  componentSlotType,
  contextSlotType,
  createSlotPath,
  elementSlotType,
  fragmentSlotType,
  textSlotType,
  type TextSlotType,
} from "./slot";
import type { Draft } from "./draft";
import {
  ensureFreshComponentDraft,
  ensureFreshContextDraft,
  ensureFreshElementDraft,
  ensureFreshFragmentDraft,
} from "./draft";
import { emptyMap, isArrayChildren } from "../general";
import {
  getArrayFragmentSlotKey,
  getComponentSlotKey,
  getContextSlotKey,
  getElementSlotKey,
  getFragmentSlotKey,
  getTextSlotKey,
} from "./slot-keys";

export type Intent<T extends SlotType = SlotType> = T extends SlotType
  ? {
      _key: string | undefined;
      children: SlotChildren<T>;
      component: SlotComponent<T>;
      context: SlotContext<T>;
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
): Intent<FragmentSlotType> {
  return {
    _key: undefined,
    children,
    component: undefined,
    context: undefined,
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
): Intent<TextSlotType> {
  return {
    _key: undefined,
    children: undefined,
    component: undefined,
    context: undefined,
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

export function getIntentChildren(
  children: Children | ReadonlyArray<Children>,
): ReadonlyArray<Children> {
  if (Array.isArray(children)) return children;
  if (children === undefined) return emptyChildren;
  return [children];
}
export function draftToIntent(
  draft: Draft<ComponentSlotType>,
  key: string,
  index: number,
  parentPath: string,
): Intent<ComponentSlotType>;
export function draftToIntent(
  draft: Draft<ContextSlotType>,
  key: string,
  index: number,
  parentPath: string,
): Intent<ContextSlotType>;
export function draftToIntent(
  draft: Draft<ElementSlotType>,
  key: string,
  index: number,
  parentPath: string,
): Intent<ElementSlotType>;
export function draftToIntent(
  draft: Draft<FragmentSlotType>,
  key: string,
  index: number,
  parentPath: string,
): Intent<FragmentSlotType>;
export function draftToIntent(draft: Draft, key: string, index: number, parentPath: string) {
  const same = draft as any as Intent;
  same.key = key;
  same.path = `${parentPath}/${key}`;
  same.index = index;
  return same;
}

export function childToIntent(child: Child, index: number, parentPath: string): Intent {
  child ??= "";
  const type = typeof child;
  if (type !== "object") {
    let text: string;
    switch (type) {
      case "string":
        text = child as string;
        break;
      case "boolean":
        text = "";
        break;
      default:
        text = `${child}`;
    }
    const key = getTextSlotKey(index);
    return asTextIntent(text, index, key, parentPath);
  }
  child = child as Draft;
  switch (child.type) {
    case componentSlotType: {
      child = ensureFreshComponentDraft(child);
      const key = getComponentSlotKey(child, index);
      return draftToIntent(child, key, index, parentPath);
    }
    case elementSlotType: {
      child = ensureFreshElementDraft(child);
      const key = getElementSlotKey(child, index);
      return draftToIntent(child, key, index, parentPath);
    }
    case fragmentSlotType: {
      child = ensureFreshFragmentDraft(child);
      const key = getFragmentSlotKey(child, index);
      return draftToIntent(child, key, index, parentPath);
    }
    case contextSlotType: {
      child = ensureFreshContextDraft(child);
      const key = getContextSlotKey(child, index);
      return draftToIntent(child, key, index, parentPath);
    }
    default: {
      throw new Error(`Invalid child type ${JSON.stringify(child satisfies never)}`);
    }
  }
}

export function childrenToIntents(
  children: ReadonlyArray<Children>,
  parentPath: string,
): ReadonlyMap<string, Intent | Slot> {
  if (children.length === 0) return emptyMap;
  const intents = new Map<string, Intent>();
  for (let index = 0; index < children.length; index++) {
    let child = children[index];
    if (isArrayChildren(child)) {
      const key = getArrayFragmentSlotKey(index);
      intents.set(key, arrayAsFragmentIntent(child, key, index, parentPath));
      continue;
    }
    const intent = childToIntent(child, index, parentPath);
    intents.set(intent.key, intent);
  }

  return intents;
}

export function inheritSlot(draft: Intent, prev: Slot): Slot {
  draft.prevText = prev.text;
  draft.prevProps = prev.props;
  draft.headNode = prev.headNode;
  draft.tailNode = prev.tailNode;
  draft.instance = prev.instance;
  draft.slots = prev.slots;
  return draft as Slot;
}
