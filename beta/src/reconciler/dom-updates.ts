// Atomic-move support detection (Chromium 133+). When available, prefer
// `moveBefore` over `insertBefore` — it relocates a node without detaching
// it, preserving focus, selection, iframe state, and connected callbacks.
// Falls back to `insertBefore` on older engines (the legacy detach/reinsert
// path that the early-exit guards in `moveRange` and `placeNode` already
// minimise).

import type { BaseInstance } from "../instances/base-instance";

type WithMoveBefore = Node & { moveBefore: (node: Node, child: Node | null) => void };
const SUPPORTS_MOVE_BEFORE =
  typeof Node !== "undefined" &&
  typeof (Node.prototype as Partial<WithMoveBefore>).moveBefore === "function";

export function placeNode(parent: Node, node: Node, beforeNode: Node | null) {
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

export function moveRange(first: Node, last: Node, parent: Node, beforeNode: Node | null) {
  if (
    first.parentNode === parent &&
    last.parentNode === parent &&
    last.nextSibling === beforeNode
  ) {
    return;
  }
  try {
    let cur: Node | null = first;
    while (cur) {
      const next: Node | null = cur === last ? null : cur.nextSibling;
      placeNode(parent, cur, beforeNode);
      cur = next;
    }
  } catch (e) {
    console.error("insertInstanceAnchors");
    throw e;
  }
}

export function move(first: Node, last: Node, parent: Node, beforeNode: Node | null) {
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

export function insertBefore(parentDom: Node, node: Node, beforeNode: Node | null) {
  parentDom.insertBefore(node, beforeNode);
}

export function removeRange(first: Node, last: Node) {
  const parentNode = first.parentNode!;
  let cur: Node | null = first;
  while (cur) {
    const next: Node | null = cur === last ? null : cur.nextSibling;
    parentNode.removeChild(cur);
    cur = next;
  }
}

export function setText(node: Text, text: string) {
  node.nodeValue = text;
}

export function insertInstanceAnchors(instance: BaseInstance, beforeNode: Node | null) {
  try {
    instance.parentDom.insertBefore(instance.endAnchor, beforeNode);
    instance.parentDom.insertBefore(instance.startAnchor, instance.endAnchor);
  } catch (e) {
    console.error("insertInstanceAnchors");
    throw e;
  }
}

export function insertFragmentAnchors(
  parentDom: Node,
  stagingDom: Node,
  endAnchor: Node,
  beforeNode: Node | null,
) {
  stagingDom.appendChild(endAnchor);
  parentDom.insertBefore(stagingDom, beforeNode);
}
