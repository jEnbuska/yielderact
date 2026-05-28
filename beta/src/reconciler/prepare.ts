import type { Slot } from "../slots/slot";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  fragmentSlotType,
} from "../slots/slot";
import type { Child, Children } from "../jsx";
import {
  draftToIntent,
  getArrayFragmentSlotKey,
  getComponentSlotKey,
  getContextSlotKey,
  getElementSlotKey,
  getFragmentSlotKey,
  getLeafChildKey,
} from "../keys";
import { emptyMap, isArrayChildren } from "../general";
import type { SlotIntent } from "../slots/slot-intent";
import { asFragmentIntent, asTextIntent } from "../slots/slot-intent";

export function childToIntent(child: NonNullable<Child>): SlotIntent {
  child ??= "";
  if (typeof child !== "object") {
    return asTextIntent(`${child}`, 0, getLeafChildKey(0), "");
  }
  switch (child.type) {
    case componentSlotType: {
      return draftToIntent(child, getComponentSlotKey(child, 0), 0, "");
    }
    case elementSlotType: {
      return draftToIntent(child, getElementSlotKey(child, 0), 0, "");
    }
    case fragmentSlotType: {
      return draftToIntent(child, getFragmentSlotKey(child, 0), 0, "");
    }
    case contextSlotType: {
      return draftToIntent(child, getContextSlotKey(child, 0), 0, "");
    }
    default: {
      throw new Error(`Invalid child type ${JSON.stringify(child satisfies never)}`);
    }
  }
}

export function childrenToIntents(
  children: ReadonlyArray<Children>,
  parentPath: string,
): ReadonlyMap<string, SlotIntent> {
  if (children.length === 0) return emptyMap;
  const intents = new Map<string, SlotIntent>();
  for (let index = 0; index < children.length; index++) {
    const child = children[index] ?? "";
    if (isArrayChildren(child)) {
      const key = getArrayFragmentSlotKey(index);
      intents.set(key, asFragmentIntent(child, key, index, parentPath));
      continue;
    }
    if (typeof child !== "object") {
      const text = `${child}`;
      const key = getLeafChildKey(index);
      intents.set(key, asTextIntent(text, index, key, parentPath));
      continue;
    }
    switch (child.type) {
      case componentSlotType: {
        const key = getComponentSlotKey(child, index);
        intents.set(key, draftToIntent(child, key, index, parentPath));
        break;
      }
      case elementSlotType: {
        const key = getElementSlotKey(child, index);
        intents.set(key, draftToIntent(child, key, index, parentPath));
        break;
      }
      case fragmentSlotType: {
        const key = getFragmentSlotKey(child, index);
        draftToIntent(child, key, index, parentPath);
        intents.set(key, draftToIntent(child, key, index, parentPath));
        break;
      }
      case contextSlotType: {
        const key = getContextSlotKey(child, index);
        intents.set(key, draftToIntent(child, key, index, parentPath));
        break;
      }
      default: {
        throw new Error(`Invalid child type ${JSON.stringify(child satisfies never)}`);
      }
    }
  }
  return intents;
}

export function fillIntentDrafts(
  oldSlots: ReadonlyMap<string, Slot>,
  drafts: ReadonlyMap<string, SlotIntent>,
  stableIndexes: ReadonlySet<number>,
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
