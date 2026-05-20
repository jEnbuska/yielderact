import type { Child, SingleChild } from "../jsx";
import type { BaseInstance } from "../instances/base-instance";
import type { Slot, SlotIntent } from "../slots/slot";
import type { TagNamespace } from "../render/elements/namespaces";
import type { OptionalDelegationAction } from "./types";
import {
  createDraftIntent,
  delegateRemovals,
  draftIntents,
  fillIntentDrafts,
  inheritSlot,
} from "./slot-intent";
import { delegateUi } from "./delegation";
import { moveSlot } from "./dom-updates";
import { getValuesReversed, stage } from "../general";
import { deriveStableIndexes } from "./derive-stable-indexes";
import { getChildType } from "../child";
import { buildIntentToSlot } from "./build-intent-to-slot";
import { updateSlot } from "./update-slot";
import { mountSlot } from "./mount-slot";
import { removeSlotNodes } from "./dom-remove";

export function* reconcile(
  children: Child[],
  parentInstance: BaseInstance,
  parentDom: Node,
  path: string,
  oldSlots: Map<string, Slot>,
  ns: TagNamespace,
  beforeNode: Node | null,
): Generator<OptionalDelegationAction, Map<string, Slot>, BaseInstance> {
  const drafts = draftIntents(children, path);
  yield* delegateRemovals(drafts, oldSlots);
  const stableIndexes = deriveStableIndexes(drafts, oldSlots);
  fillIntentDrafts(oldSlots, drafts, stableIndexes);
  const intents = drafts;
  const slots = intents as any as Map<string, Slot>;
  for (const next of getValuesReversed(intents)) {
    let slot: Slot;
    if (next.action === "CREATED") {
      yield* buildIntentToSlot(next, parentInstance, ns, parentDom, beforeNode);
      slot = next as Slot;
    } else {
      slot = next;
      yield* updateSlot(slot, parentInstance, ns);
      if (next.move) yield delegateUi(stage(moveSlot, slot, parentDom, beforeNode));
    }
    slots.set(slot.key, slot);
    beforeNode = slot.headNode;
  }
  return slots;
}

export function* reconcileRoot(
  child: SingleChild,
  parentInstance: BaseInstance,
  parentDom: Node,
  prevSlot: Slot,
  ns: TagNamespace,
  beforeNode: Node | null,
): Generator<OptionalDelegationAction, Slot, BaseInstance> {
  const type = getChildType(child);
  const intent = createDraftIntent(type, child, 0, "");
  if (intent.key !== prevSlot.key) {
    yield delegateUi(stage(removeSlotNodes, prevSlot));
    yield* buildIntentToSlot(intent, parentInstance, ns, parentDom, beforeNode);
    return intent as Slot;
  } else {
    inheritSlot(intent, prevSlot);
    yield* updateSlot(intent, parentInstance, ns);
    return intent;
  }
}

export function* mount(
  children: Child[],
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  parentPath: string,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, Map<string, Slot>> {
  const drafts = draftIntents(children, parentPath);
  const slots = drafts as any as Map<string, Slot>;
  for (const [key, draft] of drafts) {
    yield* mountSlot(draft as SlotIntent, parentInstance, parentDom, stagingDom, ns);
    slots.set(key, draft as Slot);
  }
  return slots;
}

export function* mountRoot(
  child: SingleChild,
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, Slot> {
  const type = getChildType(child);
  const draft = createDraftIntent(type, child, 0, "");
  yield* mountSlot(draft, parentInstance, parentDom, stagingDom, ns);
  return draft as Slot;
}
