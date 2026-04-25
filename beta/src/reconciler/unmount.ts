/**
 * Leaf module for the unmount path — kept free of any imports that pull in
 * `BaseInstance` / `ComponentInstance` / `ContextInstance` so it can be used
 * from both the reconciler and `BaseInstance` without forming an import
 * cycle. `slots.ts` only references the instance classes via `import type`,
 * so its presence here is safe.
 */
import {
  isComponentSlot,
  isContextSlot,
  isElementSlot,
  isFragmentSlot,
  type Slot,
} from "../render/slots";
import type { UpdateResult } from "./types";
import { updateResult } from "./utils";

export function* unmountSlot(slot: Slot): Generator<UpdateResult, void> {
  if (isComponentSlot(slot) || isContextSlot(slot)) {
    // The instance tears down its own subtree — see BaseInstance.render's
    // unmount branch.
    yield updateResult({ type: "UNMOUNT", instance: slot.instance, slotPath: slot.slotPath });
  } else if (isElementSlot(slot)) {
    for (const child of slot.slots) yield* unmountSlot(child);
  } else if (isFragmentSlot(slot)) {
    for (const child of slot.slots) yield* unmountSlot(child);
  }
}

export function removeRange(first: Node, last: Node, parent: Node): void {
  let cur: Node | null = first;
  while (cur) {
    const next: Node | null = cur === last ? null : cur.nextSibling;
    if (cur.parentNode === parent) parent.removeChild(cur);
    cur = next;
  }
}
