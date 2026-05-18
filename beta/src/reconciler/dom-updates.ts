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

import { first, getValuesReversed, last } from "../general";
import type { SlotElement } from "../render/elements/namespaces";

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
      const node = last<Comment>(slot.nodes);
      moveBefore(parentDom, node, beforeNode);
      beforeNode = node;
      if (slot.instance.slot) {
        moveSlot(slot.instance.slot, parentDom, beforeNode);
        beforeNode = first<Node>(slot.instance.slot.nodes);
      }
      moveBefore(parentDom, first<Comment>(slot.nodes), beforeNode);
      break;
    }
    case textSlotType:
    case elementSlotType:
      moveBefore(parentDom, first<Text | SlotElement>(slot.nodes), beforeNode);
      break;
    case fragmentSlotType: {
      moveBefore(parentDom, last<Comment>(slot.nodes), beforeNode);
      beforeNode = last<Comment>(slot.nodes);
      for (const child of getValuesReversed(slot.slots)) {
        moveSlot(child, parentDom, beforeNode);
        beforeNode = last<Node>(child.nodes);
      }
      moveBefore(parentDom, first<Comment>(slot.nodes), beforeNode);
      break;
    }
  }
}
export function removeSlotNodes(slot: Slot) {
  switch (slot.type) {
    case textSlotType:
    case elementSlotType:
      first<SlotElement | Text>(slot.nodes).remove();
      break;
    case fragmentSlotType:
      removeFragmentNodes(slot);
      break;
    default:
      removeInstanceNodes(slot);
  }
}

function removeInstanceNodes({ nodes, instance }: ComponentSlot | ContextSlot) {
  last(nodes).remove();
  removeSlotNodes(instance.slot!);
  first(nodes).remove();
}

function removeFragmentNodes(slot: FragmentSlot) {
  last(slot.nodes).remove();
  for (const next of slot.slots.values().toArray().reverse()) {
    switch (next.type) {
      case textSlotType:
      case elementSlotType:
        first<Comment>(slot.nodes).remove();
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
  first(slot.nodes).remove();
}

export function appendSlotNodes(stagingDom: Node, slot: Slot) {
  for (const node of slot.nodes) {
    stagingDom.appendChild(node);
  }
}
