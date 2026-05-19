import type {
  CreateSlotIntent,
  DraftSlotIntent,
  EmptySlotType,
  EmptySlotTypeToTextSlotType,
  FragmentChild,
  RenderSlotIntent,
  Slot,
  SlotChild,
  SlotIntent,
  SlotType,
  TextSlotType,
} from "../slots/slot";
import { emptySlotType, fragmentSlotType, textSlotType } from "../slots/slot";
import type { Child, VNode, VNodeProps } from "../jsx";
import { Fragment } from "../jsx";
import { getChildKey, getChildType } from "../child";
import type { DelegatedUI } from "./delegation";
import { delegateUi } from "./delegation";
import { emptyMap, stage } from "../general";

import { removeSlotNodes } from "./dom-updates";

export function draftIntents(children: Child[]): Map<string, DraftSlotIntent | Slot> {
  if (children.length === 0) return emptyMap;
  const drafts = new Map<string, DraftSlotIntent>();
  for (let index = 0; index < children.length; index++) {
    let child = children[index]!;
    let type: SlotType | EmptySlotType;
    if (Array.isArray(child)) {
      child = asFragmentChild(child);
      type = fragmentSlotType;
    } else {
      type = getChildType(child);
    }
    const key = getChildKey(child, index, type);
    const intent = createDraftIntent(type, child, key, index);
    drafts.set(key, intent);
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

const defaultNodes: [Node, ...Node[]] = [] as any;
export function createDraftIntent<T extends SlotType | EmptySlotType>(
  type: T,
  slotChild: SlotChild<T>,
  key: string,
  index: number,
): DraftSlotIntent<EmptySlotTypeToTextSlotType<T>> {
  let child: SlotChild<T> | undefined;
  let text: string | undefined;
  let props: VNodeProps | undefined;
  let children: Child[];
  switch (type) {
    case emptySlotType:
      text = "";
      type = textSlotType as any;
      children = emptyChildren;
      break;
    case textSlotType:
      text = String(slotChild);
      children = emptyChildren;
      break;
    default:
      child = slotChild;
      props = (slotChild as VNode).props;
      children = getIntentChildren(
        slotChild as SlotChild<Exclude<T, TextSlotType | EmptySlotType>>,
      );
  }
  return {
    action: "",
    path: "",
    type,
    props,
    child,
    children,
    key,
    index,
    move: false,
    old: undefined,
    text,
    nodes: undefined,
  } as any;
}

export function fillIntentDrafts(
  oldSlots: Map<string, Slot>,
  drafts: Map<string, DraftSlotIntent>,
  stableIndexes: Set<number>,
): asserts drafts is Map<string, SlotIntent | Slot> {
  for (const [key, draft] of drafts) {
    const old = oldSlots.get(key);
    if (old !== undefined) {
      const p = draft as RenderSlotIntent;
      p.action = "RENDERED";
      p.move = !stableIndexes.has(old.index);
      p.old = old;
    } else {
      const p = draft as CreateSlotIntent;
      p.action = "CREATED";
    }
  }
  return drafts as Map<string, SlotIntent>;
}

const emptyChildren: Child[] = [];
function getIntentChildren<T extends Exclude<SlotType, EmptySlotType | TextSlotType>>(
  child: SlotChild<T>,
): Child {
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
  for (const [key, slot] of oldSlots) {
    if (drafts.has(key)) continue;
    yield delegateUi(stage(removeSlotNodes, slot));
  }
}
