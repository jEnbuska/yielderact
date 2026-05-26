/**
 * Child type guards and narrowing helpers.
 *
 * Everything the renderer needs to answer "what kind of thing is this
 * Child?" lives here — the reconciler, the slot builders, and tests all
 * go through these helpers rather than re-testing `typeof` or poking at
 * `vnode.type` inline. Keeping the guards in one file means the full
 * Child/VNode taxonomy is visible at a glance.
 */
import { type Component } from "./jsx";
import { randomId } from "./general";
import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  FragmentSlotType,
} from "./slots/slot";
import type { DraftIntent } from "./slots/intent-draft";
import type { SlotIntent } from "./slots/slot-intent";

const otherIdMap = new WeakMap<Component<any>>();

export function getComponentSlotKey(draft: DraftIntent<ComponentSlotType>, index: number): string {
  const slotId = otherIdMap.getOrInsertComputed(draft.component, randomId);
  const componentKey = draft.key ?? index;
  return `"${slotId}""${typeof componentKey}"${componentKey}`;
}

export function getElementSlotKey(draft: DraftIntent<ElementSlotType>, index: number) {
  const { element } = draft;
  const elementKey = draft.key ?? index;
  return `"${element}${typeof elementKey}${elementKey}"`;
}

const fragmentTypeKey = randomId();
export function getFragmentSlotKey(draft: DraftIntent<FragmentSlotType>, index: number): string {
  const fragmentKey = draft.key ?? index;
  return `"${fragmentTypeKey}${typeof fragmentKey}${fragmentKey}"`;
}

export function getArrayFragmentSlotKey(index: number): string {
  return `"${fragmentTypeKey}number${index}"`;
}

export function getContextSlotKey(draft: DraftIntent<ContextSlotType>, index: number): string {
  const contextKey = draft.key ?? index;
  const { context } = draft;
  return `"${context.id}${typeof contextKey}${contextKey}"`;
}

export function getLeafChildKey(index: number): string {
  return `"leaf${index}"`;
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
  draft.key = key;
  draft.path = `${parentPath}/${key}`;
  draft.index = index;
  return draft;
}
