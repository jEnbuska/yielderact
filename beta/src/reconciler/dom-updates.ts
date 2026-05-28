import type { ComponentSlotType, ContextSlotType, Slot } from "../slots/slot";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  type FragmentSlotType,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";

import { getMapValuesReversed } from "../general";

type WithMoveBefore = Node & { moveBefore: (node: Node, child: Node | null) => void };

export function insertBefore(parentDom: Node, node: Node, beforeNode: Node | null) {
  parentDom.insertBefore(node, beforeNode);
}

function moveBefore(parent: Node, node: Node, beforeNode: Node | null) {
  try {
    (parent as WithMoveBefore).moveBefore(node, beforeNode);
    return;
  } catch {
    parent.insertBefore(node, beforeNode);
  }
}

export function moveSlot(slot: Slot, parentDom: Node, beforeNode: Node | null): void {
  switch (slot.type) {
    case componentSlotType:
    case contextSlotType: {
      const node = slot.tailNode;
      moveBefore(parentDom, node, beforeNode);
      beforeNode = node;
      if (slot.instance.slot) {
        moveSlot(slot.instance.slot, parentDom, beforeNode);
        beforeNode = slot.instance.slot.headNode;
      }
      moveBefore(parentDom, slot.headNode, beforeNode);
      break;
    }
    case textSlotType:
    case elementSlotType:
      moveBefore(parentDom, slot.headNode, beforeNode);
      break;
    case fragmentSlotType: {
      const node = slot.tailNode;
      moveBefore(parentDom, node, beforeNode);
      beforeNode = node;
      for (const child of getMapValuesReversed(slot.slots)) {
        moveSlot(child, parentDom, beforeNode);
        beforeNode = child.headNode;
      }
      moveBefore(parentDom, slot.headNode, beforeNode);
      break;
    }
  }
}
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
