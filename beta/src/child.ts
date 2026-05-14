/**
 * Child type guards and narrowing helpers.
 *
 * Everything the renderer needs to answer "what kind of thing is this
 * Child?" lives here — the reconciler, the slot builders, and tests all
 * go through these helpers rather than re-testing `typeof` or poking at
 * `vnode.type` inline. Keeping the guards in one file means the full
 * Child/VNode taxonomy is visible at a glance.
 */
import { type Context, ContextSymbol } from "./context";
import { type Child, type Component, Fragment, type VNode } from "./jsx";

import type { ElementChild, SlotChild, SlotType } from "./slots/slot";
import { elementSlotType, emptySlotType, textSlotType } from "./slots/slot";

// ---------------------------------------------------------------------------
// Child-level guards (take the full `Child` union as input)
// ---------------------------------------------------------------------------

/** True when the child is a text primitive (string or number). */
export function isTextChild(child: Child): child is string | number {
  return typeof child === "string" || typeof child === "number";
}

// ---------------------------------------------------------------------------
// VNode-level guards (take an already-narrowed VNode)
// ---------------------------------------------------------------------------

/** Narrows a VNode to the Fragment marker. */
export function isFragmentVNode(child: VNode): child is VNode<typeof Fragment> {
  return child.type === Fragment;
}

/** Narrows a VNode to an intrinsic element (`<div>`, `<span>`, ...). */
export function isElementVNode(child: VNode): child is VNode<keyof JSX.IntrinsicElements> {
  return typeof child.type === "string";
}

/**
 * True when the child produces no DOM at all: `null`, `undefined`, either
 * boolean, or a VNode with `shown === false`. The reconciler maps these
 * to an `EmptySlot`.
 */
export function isEmptyChild(child: Child): child is null | undefined | boolean {
  return child == null || typeof child === "boolean";
}

export function isContextVNode(child: VNode): child is VNode<Context> {
  return ContextSymbol in child;
}

// ---------------------------------------------------------------------------
// Child helpers
// ---------------------------------------------------------------------------

const stringIdMap = new Map<string, string>();
const otherIdMap = new WeakMap<typeof Fragment | Component<any> | Context, string>();

function randomId(): string {
  let s = Math.random().toString(36).slice(2);
  while (s.length < 8) s += Math.random().toString(36).slice(2);
  return s.slice(0, 8);
}
/**
 * The key the reconciler uses to match a child against a previous slot.
 * Falls back to the positional index when the child has no `key`.
 */
export function getChildKey<C extends SlotChild>(
  child: C,
  fallback: number,
  type: SlotType,
): string {
  switch (type) {
    case emptySlotType:
    case textSlotType: {
      const slotId = stringIdMap.getOrInsertComputed(type, randomId);
      const numberId = stringIdMap.getOrInsertComputed("number", randomId);
      return `${slotId}${numberId}${fallback}`;
    }
    case elementSlotType: {
      const { type, props } = child as ElementChild;
      const slotId = stringIdMap.getOrInsertComputed(type, randomId);
      const keyId = props.key ?? fallback;
      const keyTypeId = stringIdMap.getOrInsertComputed(typeof keyId, randomId);
      return `${slotId}${keyTypeId}${keyId}`;
    }
    default: {
      const { type, props } = child as VNode<typeof Fragment | Component | Context>;
      const slotId = otherIdMap.getOrInsertComputed(type, randomId);
      const keyId = props.key ?? fallback;
      const keyTypeId = stringIdMap.getOrInsertComputed(typeof keyId, randomId);
      return `${slotId}${keyTypeId}${keyId}`;
    }
  }
}
