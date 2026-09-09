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

function getRenderableChild(child: Child): Exclude<Child, boolean | undefined | null> {
  switch (child) {
    case false:
    case true:
    case undefined:
    case null:
      return "";
    default:
      return child;
  }
}

export function childToIntent(child: Child): Intent {
  let intentChild = getRenderableChild(child);
  if (typeof intentChild !== "object") {
    return asTextIntent(`${intentChild}`, 0, getTextSlotKey(0), "");
  }
  switch (intentChild.type) {
    case componentSlotType: {
      intentChild = ensureFreshComponentDraft(intentChild);
      return draftToIntent(intentChild, getComponentSlotKey(intentChild, 0), 0, "");
    }
    case elementSlotType: {
      child = ensureFreshElementDraft(intentChild);
      return draftToIntent(intentChild, getElementSlotKey(intentChild, 0), 0, "");
    }
    case fragmentSlotType: {
      intentChild = ensureFreshFragmentDraft(intentChild);
      return draftToIntent(intentChild, getFragmentSlotKey(intentChild, 0), 0, "");
    }
    case contextSlotType: {
      intentChild = ensureFreshContextDraft(intentChild);
      return draftToIntent(intentChild, getContextSlotKey(intentChild, 0), 0, "");
    }
    default: {
      throw new Error(`Invalid child type ${JSON.stringify(intentChild satisfies never)}`);
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
    let intentChild = getRenderableChild(child);
    if (typeof intentChild !== "object") {
      const text = `${intentChild}`;
      const key = getTextSlotKey(index);
      intents.set(key, asTextIntent(text, index, key, parentPath));
      continue;
    }
    switch (intentChild.type) {
      case componentSlotType: {
        intentChild = ensureFreshComponentDraft(intentChild);
        const key = getComponentSlotKey(intentChild, index);
        intents.set(key, draftToIntent(intentChild, key, index, parentPath));
        break;
      }
      case elementSlotType: {
        intentChild = ensureFreshElementDraft(intentChild);
        const key = getElementSlotKey(intentChild, index);
        intents.set(key, draftToIntent(intentChild, key, index, parentPath));
        break;
      }
      case fragmentSlotType: {
        intentChild = ensureFreshFragmentDraft(intentChild);
        const key = getFragmentSlotKey(intentChild, index);
        intents.set(key, draftToIntent(intentChild, key, index, parentPath));
        break;
      }
      case contextSlotType: {
        intentChild = ensureFreshContextDraft(intentChild);
        const key = getContextSlotKey(intentChild, index);
        intents.set(key, draftToIntent(intentChild, key, index, parentPath));
        break;
      }
      default: {
        throw new Error(`Invalid child type ${JSON.stringify(intentChild satisfies never)}`);
      }
    }
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
