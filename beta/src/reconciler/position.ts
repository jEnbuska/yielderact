import type { Slot } from "../render/slots";
import { componentSlotType, contextSlotType, fragmentSlotType } from "../render/slots";
import type { UpdateResult } from "./types";

import { updateResult } from "./utils";

// Atomic-move support detection (Chromium 133+). When available, prefer
// `moveBefore` over `insertBefore` — it relocates a node without detaching
// it, preserving focus, selection, iframe state, and connected callbacks.
// Falls back to `insertBefore` on older engines (the legacy detach/reinsert
// path that the early-exit guards in `moveRange` and `placeNode` already
// minimise).
type WithMoveBefore = Node & { moveBefore: (node: Node, child: Node | null) => void };
const SUPPORTS_MOVE_BEFORE =
  typeof Node !== "undefined" &&
  typeof (Node.prototype as Partial<WithMoveBefore>).moveBefore === "function";

function placeNode(parent: Node, node: Node, beforeNode: Node | null): void {
  if (node.parentNode === parent && node.nextSibling === beforeNode) return;
  if (SUPPORTS_MOVE_BEFORE) {
    try {
      (parent as WithMoveBefore).moveBefore(node, beforeNode);
      return;
    } catch {
      // moveBefore throws under a few well-defined conditions (cycle,
      // disconnected node in some impls). Fall through to insertBefore.
    }
  }
  parent.insertBefore(node, beforeNode);
}

export function* ensureSlotPosition(
  slot: Slot,
  parentDom: Node,
  beforeNode: Node | null,
): Generator<UpdateResult, void> {
  switch (slot.type) {
    case componentSlotType:
    case contextSlotType:
      return yield updateResult({
        type: "UPDATE_UI",
        callback: () =>
          moveRange(slot.instance.startAnchor, slot.instance.endAnchor, parentDom, beforeNode),
      });
    case fragmentSlotType:
      return yield updateResult({
        type: "UPDATE_UI",
        callback: () => moveRange(slot.node, slot.endAnchor, parentDom, beforeNode),
      });
    default:
      return yield updateResult({
        type: "UPDATE_UI",
        callback: () => placeNode(parentDom, slot.node, beforeNode),
      });
  }
}

export function moveRange(first: Node, last: Node, parent: Node, beforeNode: Node | null): void {
  if (
    first.parentNode === parent &&
    last.parentNode === parent &&
    last.nextSibling === beforeNode
  ) {
    return;
  }
  let cur: Node | null = first;
  while (cur) {
    const next: Node | null = cur === last ? null : cur.nextSibling;
    placeNode(parent, cur, beforeNode);
    cur = next;
  }
}
