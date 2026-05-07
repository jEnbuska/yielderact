import type { Slot } from "./slot";
import { emptySlotType, textSlotType } from "./type";
import type { SlotKey } from "./general";

export function getSlotKey(slot: Slot): SlotKey {
  if (slot.type === emptySlotType || slot.type === textSlotType) return slot.index;
  return slot.key;
}
