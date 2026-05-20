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
import { type Child, type Component, Fragment, type SingleChild, type VNode } from "./jsx";

import type {
  ComponentChild,
  ContextChild,
  ElementChild,
  EmptySlotType,
  FragmentChild,
  SlotType,
} from "./slots/slot";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  emptySlotType,
  fragmentSlotType,
  textSlotType,
} from "./slots/slot";

// ---------------------------------------------------------------------------
// Child-level guards (take the full `Child` union as input)
// ---------------------------------------------------------------------------

/** True when the child is a text primitive (string or number). */
export function isTextChild(child: Child): child is string | number | bigint {
  const type = typeof child;
  switch (type) {
    case "string":
    case "number":
    case "bigint":
      return true;
  }
  return false;
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

const otherIdMap = new WeakMap<typeof Fragment | Component<any> | Context, string>();

let randomRoot: string | undefined;
let randomIndex = 0;
function randomId(): string {
  if (randomRoot === undefined) {
    randomRoot = Math.random().toString(36).slice(2);
    while (randomRoot.length < 8) randomRoot = Math.random().toString(36).slice(2);
  }
  return `${randomRoot}${randomIndex++}`;
}

export function getChildType(child: SingleChild): SlotType | EmptySlotType {
  if (isEmptyChild(child)) return emptySlotType;
  if (isTextChild(child)) return textSlotType;
  if (child.props.shown === false) return emptySlotType;
  if (isElementVNode(child)) return elementSlotType;
  if (isFragmentVNode(child)) return fragmentSlotType;
  if (isContextVNode(child)) return contextSlotType;
  if (typeof child.type === "function") return componentSlotType;
  throw new Error("Invalid child");
}

export function getCustomChildKey(
  child: FragmentChild | ComponentChild | ContextChild,
  fallback: number,
): string {
  const { type, props } = child as VNode<typeof Fragment | Component | Context>;
  const slotId = otherIdMap.getOrInsertComputed(type, randomId);
  const key = props.key ?? fallback;
  return `"${slotId}"${typeof key}"${key}"`;
}

export function getLeafChildKey(fallback: number): string {
  return `"leaf""${fallback}"`;
}

export function getElementChildKey(child: ElementChild, fallback: number): string {
  const { type, props } = child;
  const key = props.key ?? fallback;
  return `"${type}"${typeof key}"${key}"`;
}
