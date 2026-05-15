import type {
  CreateSlotIntent,
  DraftSlotIntent,
  EmptySlotType,
  FragmentChild,
  RenderSlotIntent,
  Slot,
  SlotChild,
  SlotIntent,
  SlotType,
  TextSlotType,
} from "../slots/slot";
import { emptySlotType, textSlotType } from "../slots/slot";
import type { Child, VNode, VNodeProps } from "../jsx";
import { Fragment } from "../jsx";
import type { DelegatedUI } from "./types";
import { getChildKey, getChildType } from "../child";
import { $delegateUi, slotFirstNode, slotLastNode } from "./utils";
import { stage } from "../general";

import { removeRange } from "./dom-updates";

export function draftIntents(children: Child[]) {
  const drafts = new Map<string, DraftSlotIntent>();
  let prevKey: string | undefined;
  for (let index = 0; index < children.length; index++) {
    let child = children[index]!;
    if (Array.isArray(child)) child = asFragmentChild(child);
    const type = getChildType(child);
    const key = getChildKey(child, index, type);
    const intent = createDraftIntent(type, child, key, index);
    drafts.set(key, intent);
    if (prevKey !== undefined) drafts.get(prevKey)!.nextKey = key;
    prevKey = key;
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

export function createDraftIntent<T extends SlotType>(
  type: T,
  child: SlotChild<T>,
  key: string,
  index: number,
): DraftSlotIntent<T> {
  let slotChild: SlotChild<T> | undefined;
  let text: string | undefined;
  let props: VNodeProps | undefined;
  switch (type) {
    case emptySlotType:
      break;
    case textSlotType:
      text = String(child);
      break;
    default:
      slotChild = child;
      props = (child as VNode).props;
  }
  return {
    action: "INITIAL",
    type,
    props,
    child: slotChild,
    children: getIntentChildren(type, child),
    key,
    index,
    move: false,
    prev: undefined,
    nextKey: undefined,
    text,
  } as any;
}

export function fillIntentDrafts(
  prevSlots: Map<string, Slot>,
  drafts: Map<string, DraftSlotIntent>,
  stableIndexes: Set<number>,
): asserts drafts is Map<string, SlotIntent> {
  for (const [key, draft] of drafts) {
    const prev = prevSlots.get(key);
    if (prev !== undefined) {
      const p = draft as RenderSlotIntent;
      p.action = "RENDERED";
      p.move = !stableIndexes.has(prev.index);
      p.prev = prev;
    } else {
      const p = draft as CreateSlotIntent;
      p.action = "CREATED";
    }
  }
}

const emptyChildren: Child[] = [];
function getIntentChildren<T extends SlotType>(type: T, child: SlotChild<T>): Child[] {
  switch (type) {
    case emptySlotType:
    case textSlotType:
      return emptyChildren;
  }
  const c = child as SlotChild<Exclude<SlotType, EmptySlotType | TextSlotType>>;
  if ("children" in c.props) {
    const { children } = c.props;
    if (Array.isArray(children)) return children;
    if (children == null || typeof children === "boolean") return emptyChildren;
    return [children as Child];
  }
  return emptyChildren;
}

export function* delegateRemovals(
  drafts: Map<string, any>,
  prevSlots: Map<string, Slot>,
): Generator<DelegatedUI, void, unknown> {
  for (const [key, slot] of prevSlots) {
    if (drafts.has(key)) continue;
    const first = slotFirstNode(slot);
    const last = slotLastNode(slot);
    yield $delegateUi(stage(removeRange, first, last));
  }
}
