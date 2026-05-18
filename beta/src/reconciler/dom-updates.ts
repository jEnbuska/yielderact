import type { FragmentSlot, Slot } from "../slots/slot";
import {
  type ComponentSlot,
  componentSlotType,
  type ContextSlot,
  contextSlotType,
  elementSlotType,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";
import { slotFirstNode, slotLastNode } from "./utils";

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
      moveBefore(parentDom, slot.instance.endAnchor, beforeNode);
      beforeNode = slot.instance.endAnchor;
      if (slot.instance.slot) {
        moveSlot(slot.instance.slot, parentDom, beforeNode);
        beforeNode = slotFirstNode(slot.instance.slot);
      }

      moveBefore(parentDom, slot.instance.startAnchor, beforeNode);
      break;
    }
    case textSlotType:
    case elementSlotType:
      moveBefore(parentDom, slot.node, beforeNode);
      break;
    case fragmentSlotType: {
      moveBefore(parentDom, slot.endAnchor, beforeNode);
      beforeNode = slot.endAnchor;
      for (const child of getValuesReversed(slot.slots)) {
        moveSlot(child, parentDom, beforeNode);
        beforeNode = slotLastNode(child);
      }
      moveBefore(parentDom, slot.node, beforeNode);
      break;
    }
  }
}
export function removeSlotNodes(slot: Slot) {
  switch (slot.type) {
    case textSlotType:
    case elementSlotType:
      slot.node.remove();
      break;
    case fragmentSlotType:
      removeFragmentNodes(slot);
      break;
    default:
      removeInstanceNodes(slot);
  }
}

function removeInstanceNodes(slot: ComponentSlot | ContextSlot) {
  slot.instance.endAnchor.remove();
  removeSlotNodes(slot.instance.slot!);
  slot.instance.startAnchor.remove();
}

function removeFragmentNodes(slot: FragmentSlot) {
  slot.endAnchor.remove();
  for (const next of slot.slots.values().toArray().reverse()) {
    switch (next.type) {
      case textSlotType:
      case elementSlotType:
        next.node.remove();
        break;
      case fragmentSlotType:
        for (const child of next.slots.values().toArray().reverse()) {
          removeSlotNodes(child);
        }
        break;
      default:
        removeInstanceNodes(next);
    }
  }
  slot.node.remove();
}
