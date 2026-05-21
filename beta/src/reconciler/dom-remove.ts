import type { Slot } from "../slots/slot";
import {
  type ComponentSlot,
  type ContextSlot,
  elementSlotType,
  type FragmentSlot,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";
import { getMapValuesReversed } from "../general";

export function removeSlotNodes(slot: Slot) {
  switch (slot.type) {
    case textSlotType:
    case elementSlotType:
      slot.headNode.remove();
      break;
    case fragmentSlotType:
      removeFragmentNodes(slot);
      break;
    default:
      removeInstanceNodes(slot);
  }
}

function removeInstanceNodes(slot: ComponentSlot | ContextSlot) {
  try {
    const { headNode, tailNode, instance } = slot;
    headNode.remove();
    if (instance.slot) removeSlotNodes(instance.slot);
    else console.log("NO NODES for", slot);
    tailNode.remove();
  } catch (e) {
    console.log("slot", slot);
    throw e;
  }
}

function removeFragmentNodes({ tailNode, slots, headNode }: FragmentSlot) {
  tailNode.remove();
  for (const next of getMapValuesReversed(slots)) {
    switch (next.type) {
      case textSlotType:
      case elementSlotType:
        headNode.remove();
        break;
      case fragmentSlotType:
        for (const child of getMapValuesReversed(next.slots)) {
          removeSlotNodes(child);
        }
        break;
      default:
        removeInstanceNodes(next);
    }
  }
  headNode.remove();
}
