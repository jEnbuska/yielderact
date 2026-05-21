import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  EmptySlotType,
  EmptySlotTypeToTextSlotType,
  FragmentChild,
  FragmentSlotType,
  Slot,
  SlotChild,
  SlotIntent,
  SlotIntentChild,
  SlotProps,
  SlotText,
  SlotType,
  TextSlotType,
} from "../slots/slot";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  emptySlotType,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";
import type { Children } from "../jsx";
import { Fragment } from "../jsx";
import { getChildType, getCustomChildKey, getElementChildKey, getLeafChildKey } from "../child";
import type { DelegateUI } from "./delegation";
import { deferUi } from "./delegation";
import { emptyMap, getMapValuesReversed, stage } from "../general";

import { removeSlotNodes } from "./dom-remove";

export function draftIntents(
  children: Children[],
  parentPath: string,
): ReadonlyMap<string, SlotIntent> {
  if (children.length === 0) return emptyMap;
  const drafts = new Map<string, SlotIntent>();
  for (let index = 0; index < children.length; index++) {
    let child = children[index]!;
    let type: SlotType | EmptySlotType;
    if (Array.isArray(child)) {
      child = asFragmentChild(child);
      type = fragmentSlotType;
    } else {
      type = getChildType(child);
    }
    const intent = createDraftIntent(type, child, index, parentPath);
    drafts.set(intent.key, intent);
  }
  return drafts;
}

function asFragmentChild(children: Children[]): FragmentChild {
  return {
    type: Fragment,
    props: {
      children,
    },
  };
}

export function createDraftIntent<T extends SlotType | EmptySlotType>(
  type: T,
  slotChild: SlotChild<T>,
  index: number,
  parentPath: string,
): SlotIntent<EmptySlotTypeToTextSlotType<T>> {
  let key: string;
  let child: SlotIntentChild<T> | undefined;
  let text: SlotText<T> | undefined;
  let props: SlotProps<T> | undefined;
  let children: Children[];
  switch (type) {
    case componentSlotType: {
      const c = slotChild as SlotChild<ComponentSlotType>;
      key = getCustomChildKey(c, index);
      child = c as SlotIntentChild<T>;
      children = getIntentChildren(c.props.children);
      // text = undefined
      props = c.props as SlotProps<T>;
      break;
    }
    case elementSlotType: {
      const c = slotChild as SlotChild<ElementSlotType>;
      key = getElementChildKey(c, index);
      child = c as SlotIntentChild<T>;
      children = getIntentChildren(c.props.children);
      // text = undefined
      props = c.props as SlotProps<T>;
      break;
    }
    case textSlotType: {
      const c = slotChild as SlotChild<TextSlotType>;
      key = getLeafChildKey(index);
      // child = undefined
      children = emptyChildren;
      text = String(c) as SlotText<T>;
      // props = undefined
      break;
    }
    case fragmentSlotType: {
      const c = slotChild as SlotChild<FragmentSlotType>;
      key = getCustomChildKey(c, index);
      child = c as SlotIntentChild<T>;
      children = getIntentChildren(c.props.children);
      // text = undefined
      props = c.props as SlotProps<T>;
      break;
    }
    case emptySlotType: {
      type = textSlotType as T;
      key = getLeafChildKey(index);
      // child = undefined
      children = emptyChildren;
      text = "" as SlotText<T>;
      // props = undefined
      break;
    }
    case contextSlotType: {
      const c = slotChild as SlotChild<ContextSlotType>;
      key = getCustomChildKey(c, index);
      child = c as SlotIntentChild<T>;
      children = getIntentChildren(c.props.children);
      // text = undefined;
      props = c.props as SlotProps<T>;
      break;
    }
    default: {
      throw new Error(`Invalid slot type ${type satisfies never}`);
    }
  }
  return {
    child,
    children,
    headNode: undefined,
    index,
    instance: undefined,
    key,
    move: undefined,
    path: `${parentPath}${key}`,
    prevProps: undefined,
    prevText: undefined,
    props,
    slots: emptyMap,
    tailNode: undefined,
    text,
    type,
  } satisfies Record<keyof SlotIntent, unknown> as any;
}

export function fillIntentDrafts(
  oldSlots: ReadonlyMap<string, Slot>,
  drafts: ReadonlyMap<string, SlotIntent>,
  stableIndexes: Set<number>,
): asserts drafts is ReadonlyMap<string, Slot | SlotIntent> {
  for (const [key, draft] of drafts) {
    const prev = oldSlots.get(key);
    if (prev === undefined) continue;
    inheritSlot(draft, prev);
    draft.move = !stableIndexes.has(prev.index);
  }
}

export function inheritSlot(draft: SlotIntent, prev: Slot): asserts draft is Slot {
  draft.prevProps = prev.props;
  draft.headNode = prev.headNode;
  draft.tailNode = prev.tailNode;
  draft.instance = prev.instance;
  draft.slots = prev.slots;
}

const emptyChildren: Children[] = [];
function getIntentChildren(children: Children): Children[] {
  if (Array.isArray(children)) return children;
  if (children === undefined) return emptyChildren;
  return [children];
}

export function* delegateRemovals(
  drafts: ReadonlyMap<string, any>,
  oldSlots: ReadonlyMap<string, Slot> | undefined,
): Generator<DelegateUI, void, unknown> {
  if (!oldSlots) return;
  for (const slot of getMapValuesReversed(oldSlots)) {
    if (drafts.has(slot.key)) continue;
    yield deferUi(stage(removeSlotNodes, slot));
  }
}
