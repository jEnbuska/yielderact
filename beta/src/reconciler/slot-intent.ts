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
import type { Child } from "../jsx";
import { Fragment } from "../jsx";
import { getChildType, getCustomChildKey, getElementChildKey, getLeafChildKey } from "../child";
import type { DelegatedUI } from "./delegation";
import { delegateUi } from "./delegation";
import { emptyMap, getValuesReversed, stage } from "../general";

import { removeSlotNodes } from "./dom-remove";

export function draftIntents(children: Child[], parentPath: string): Map<string, SlotIntent> {
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

function asFragmentChild(children: Child[]): FragmentChild {
  return {
    type: Fragment,
    props: {
      children,
    },
  };
}

const defaultAction = "CREATED";
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
  let children: Child[];
  switch (type) {
    case componentSlotType: {
      const c = slotChild as SlotChild<ComponentSlotType>;
      key = getCustomChildKey(c, index);
      child = c as SlotIntentChild<T>;
      children = getIntentChildren(c);
      // text = undefined
      props = c.props as SlotProps<T>;
      break;
    }
    case elementSlotType: {
      const c = slotChild as SlotChild<ElementSlotType>;
      key = getElementChildKey(c, index);
      child = c as SlotIntentChild<T>;
      children = getIntentChildren(c);
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
      children = getIntentChildren(c);
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
      children = getIntentChildren(c);
      // text = undefined;
      props = c.props as SlotProps<T>;
      break;
    }
    default: {
      throw new Error(`Invalid slot type ${type satisfies never}`);
    }
  }
  return {
    action: defaultAction,
    child,
    children,
    headNode: undefined,
    index,
    instance: undefined,
    key,
    move: undefined,
    path: `${parentPath}${key}`,
    prevProps: undefined,
    props,
    slots: emptyMap,
    tailNode: undefined,
    text,
    type,
  } satisfies Record<keyof SlotIntent, unknown> as any;
}

export function fillIntentDrafts(
  oldSlots: Map<string, Slot>,
  drafts: Map<string, SlotIntent>,
  stableIndexes: Set<number>,
): asserts drafts is Map<string, Slot | SlotIntent<SlotType, "CREATED">> {
  for (const [key, draft] of drafts) {
    const prev = oldSlots.get(key);
    if (prev === undefined) continue;
    inheritSlot(draft, prev);
    draft.move = !stableIndexes.has(prev.index);
  }
}

export function inheritSlot(draft: SlotIntent, prev: Slot): asserts draft is Slot {
  draft.action = "RENDERED";
  draft.prevProps = prev.props;
  draft.headNode = prev.headNode;
  draft.tailNode = prev.tailNode;
  draft.instance = prev.instance;
  draft.slots = prev.slots;
}

const emptyChildren: Child[] = [];
function getIntentChildren<T extends Exclude<SlotType, EmptySlotType | TextSlotType>>(
  child: SlotChild<T>,
): Child[] {
  const { children } = child.props;
  if (children === undefined) return emptyChildren;
  if (Array.isArray(children)) return children;
  return [children];
}

export function* delegateRemovals(
  drafts: Map<string, any>,
  oldSlots: Map<string, Slot> | undefined,
): Generator<DelegatedUI, void, unknown> {
  if (!oldSlots) return;
  for (const slot of getValuesReversed(oldSlots)) {
    if (drafts.has(slot.key)) continue;
    yield delegateUi(stage(removeSlotNodes, slot));
  }
}
