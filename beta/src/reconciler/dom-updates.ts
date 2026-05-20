import type { Slot } from "../slots/slot";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";

import { getValuesReversed } from "../general";

type WithMoveBefore = Node & { moveBefore: (node: Node, child: Node | null) => void };

export function insertBefore(parentDom: Node, node: Node, beforeNode: Node | null) {
  parentDom.insertBefore(node, beforeNode);
}

export function setText(node: Text, text: string) {
  node.nodeValue = text;
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
        beforeNode = slot.headNode;
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
      for (const child of getValuesReversed(slot.slots)) {
        moveSlot(child, parentDom, beforeNode);
        beforeNode = child.tailNode ?? child.headNode;
      }
      moveBefore(parentDom, slot.headNode, beforeNode);
      break;
    }
  }
}
