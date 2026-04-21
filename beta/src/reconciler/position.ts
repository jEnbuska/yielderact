import type { Slot } from "../render/slots";
import { isComponentSlot, isContextSlot, isFragmentSlot } from "../render/slots";
import type { UpdateResult } from "./types";

import { updateResult } from "./utils";

export function* ensureSlotPosition(
  slot: Slot,
  parentDom: Node,
  beforeNode: Node | null,
): Generator<UpdateResult, void> {
  if (isComponentSlot(slot) || isContextSlot(slot)) {
    return yield updateResult({
      type: "DOM",
      callback: () =>
        moveRange(slot.instance.startAnchor, slot.instance.endAnchor, parentDom, beforeNode),
    });
  }
  if (isFragmentSlot(slot)) {
    return yield updateResult({
      type: "DOM",
      callback: () => moveRange(slot.node, slot.endAnchor, parentDom, beforeNode),
    });
  }

  yield updateResult({
    type: "DOM",
    callback: () => {
      parentDom.insertBefore(slot.node, beforeNode);
    },
  });
}

function moveRange(first: Node, last: Node, parent: Node, beforeNode: Node | null): void {
  if (
    first.parentNode === parent &&
    last.parentNode === parent &&
    last.nextSibling === beforeNode
  ) {
    return;
  }
  const nodes: Node[] = [];
  let cur: Node | null = first;
  while (cur) {
    nodes.push(cur);
    if (cur === last) break;
    cur = cur.nextSibling;
  }
  for (const node of nodes) parent.insertBefore(node, beforeNode);
}
