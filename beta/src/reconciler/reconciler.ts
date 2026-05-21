import type { Child, SingleChild } from "../jsx";
import type { BaseInstance } from "../instances/base-instance";
import type { Slot } from "../slots/slot";
import type { TagNamespace } from "../render/elements/namespaces";
import type { DelegateMount, DelegateRef, DelegationAction } from "./delegation";
import { deferUi } from "./delegation";
import {
  createDraftIntent,
  delegateRemovals,
  draftIntents,
  fillIntentDrafts,
  inheritSlot,
} from "./slot-intent";
import { moveSlot } from "./dom-updates";
import { getValuesReversed, stage } from "../general";
import { deriveStableIndexes } from "./derive-stable-indexes";
import { getChildType } from "../child";
import { buildIntentToSlot } from "./build-intent-to-slot";
import { updateSlot } from "./update-slot";
import { mountIntent } from "./mount-intent";
import { removeSlotNodes } from "./dom-remove";

export function* reconcile(
  children: Child[],
  parentInstance: BaseInstance,
  parentDom: Node,
  path: string,
  oldSlots: Map<string, Slot>,
  ns: TagNamespace,
  beforeNode: Node | null,
): Generator<DelegationAction, Map<string, Slot>, BaseInstance> {
  const drafts = draftIntents(children, path);
  const stableIndexes = deriveStableIndexes(drafts, oldSlots);
  fillIntentDrafts(oldSlots, drafts, stableIndexes);
  yield* delegateRemovals(drafts, oldSlots);
  const slots = drafts as Map<string, Slot>;
  for (const slot of getValuesReversed(slots)) {
    if (slot.headNode === undefined) {
      yield* buildIntentToSlot(slot, parentInstance, ns, parentDom, beforeNode);
    } else {
      yield* updateSlot(slot, parentInstance, ns);
      if (slot.move) {
        yield deferUi(stage(moveSlot, slot, parentDom, beforeNode));
      }
    }
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
): Generator<DelegationAction, Slot, BaseInstance> {
  const type = getChildType(child);
  const intent = createDraftIntent(type, child, 0, "");
  if (intent.key !== prevSlot.key) {
    yield deferUi(stage(removeSlotNodes, prevSlot));
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
): Generator<DelegateMount | DelegateRef, Map<string, Slot>> {
  const slots = draftIntents(children, parentPath) as any as Map<string, Slot>;
  for (const draft of slots.values()) {
    yield* mountIntent(draft, parentInstance, ns, parentDom, stagingDom);
  }
  return slots;
}

export function* mountRoot(
  child: SingleChild,
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
): Generator<DelegateMount | DelegateRef, Slot> {
  const type = getChildType(child);
  const draft = createDraftIntent(type, child, 0, "");
  yield* mountIntent(draft, parentInstance, ns, parentDom, stagingDom);
  return draft as Slot;
}
