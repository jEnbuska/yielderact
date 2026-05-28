import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  FragmentSlotType,
  Slot,
} from "../slots/slot";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  fragmentSlotType,
} from "../slots/slot";
import type { Child, Children } from "../jsx";
import { emptyMap, isArrayChildren } from "../general";
import type { SlotIntent } from "../slots/slot-intent";
import { arrayAsFragmentIntent, asTextIntent, draftToIntent } from "../slots/slot-intent";
import {
  getArrayFragmentSlotKey,
  getComponentSlotKey,
  getContextSlotKey,
  getElementSlotKey,
  getFragmentSlotKey,
  getTextSlotKey,
} from "../slots/slot-keys";
import {
  asComponentDraft,
  asContextDraft,
  asElementDraft,
  asFragmentDraft,
} from "yract-beta/jsx-runtime";
import type { DraftIntent } from "../slots/intent-draft";

export function childToIntent(child: NonNullable<Child>): SlotIntent {
  child ??= "";
  if (typeof child !== "object") {
    return asTextIntent(`${child}`, 0, getTextSlotKey(0), "");
  }
  switch (child.type) {
    case componentSlotType: {
      child = ensureFreshComponentDraft(child);
      return draftToIntent(child, getComponentSlotKey(child, 0), 0, "");
    }
    case elementSlotType: {
      child = ensureFreshElementDraft(child);
      return draftToIntent(child, getElementSlotKey(child, 0), 0, "");
    }
    case fragmentSlotType: {
      child = ensureFreshFragmentDraft(child);
      return draftToIntent(child, getFragmentSlotKey(child, 0), 0, "");
    }
    case contextSlotType: {
      child = ensureFreshContextDraft(child);
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
): ReadonlyMap<string, SlotIntent | Slot> {
  if (children.length === 0) return emptyMap;
  const intents = new Map<string, SlotIntent>();
  for (let index = 0; index < children.length; index++) {
    let child = children[index] ?? "";
    if (isArrayChildren(child)) {
      const key = getArrayFragmentSlotKey(index);
      intents.set(key, arrayAsFragmentIntent(child, key, index, parentPath));
      continue;
    }
    if (typeof child !== "object") {
      const text = `${child}`;
      const key = getTextSlotKey(index);
      intents.set(key, asTextIntent(text, index, key, parentPath));
      continue;
    }
    switch (child.type) {
      case componentSlotType: {
        child = ensureFreshComponentDraft(child);
        const key = getComponentSlotKey(child, index);
        intents.set(key, draftToIntent(child, key, index, parentPath));
        break;
      }
      case elementSlotType: {
        child = ensureFreshElementDraft(child);
        const key = getElementSlotKey(child, index);
        intents.set(key, draftToIntent(child, key, index, parentPath));
        break;
      }
      case fragmentSlotType: {
        child = ensureFreshFragmentDraft(child);
        const key = getFragmentSlotKey(child, index);
        intents.set(key, draftToIntent(child, key, index, parentPath));
        break;
      }
      case contextSlotType: {
        child = ensureFreshContextDraft(child);
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

export function inheritSlot(draft: SlotIntent, prev: Slot): Slot {
  draft.prevText = prev.text;
  draft.prevProps = prev.props;
  draft.headNode = prev.headNode;
  draft.tailNode = prev.tailNode;
  draft.instance = prev.instance;
  draft.slots = prev.slots;
  return draft as Slot;
}

function ensureFreshComponentDraft(draft: DraftIntent<ComponentSlotType>) {
  if (!draft.key) return draft;
  return asComponentDraft(draft.children, draft._key, draft.component, draft.props, draft.deps);
}

function ensureFreshElementDraft(draft: DraftIntent<ElementSlotType>) {
  if (!draft.key) return draft;
  return asElementDraft(draft.children, draft._key, draft.element, draft.props);
}

function ensureFreshFragmentDraft(draft: DraftIntent<FragmentSlotType>) {
  if (!draft.key) return draft;
  return asFragmentDraft(draft.children, draft._key);
}

function ensureFreshContextDraft(draft: DraftIntent<ContextSlotType>) {
  if (!draft.key) return draft;
  return asContextDraft(draft.children, draft._key, draft.context, draft.props);
}
