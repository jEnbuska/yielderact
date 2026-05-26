import type { ComponentSlotType, ContextSlotType, FragmentSlotType, Slot } from "../slots/slot";
import { elementSlotType, fragmentSlotType, textSlotType } from "../slots/slot";
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

function removeInstanceNodes(slot: Slot<ContextSlotType | ComponentSlotType>) {
  const { headNode, tailNode, instance } = slot;
  headNode.remove();
  if (instance.slot) removeSlotNodes(instance.slot);
  tailNode.remove();
}

function removeFragmentNodes({ tailNode, slots, headNode }: Slot<FragmentSlotType>) {
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
