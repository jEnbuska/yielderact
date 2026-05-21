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

export function getChildType(child: Child): SlotType | EmptySlotType {
  if (child == null) return emptySlotType;
  const typeOfChild = typeof child;
  switch (typeOfChild) {
    case "boolean":
      return emptySlotType;
    case "string":
    case "number":
    case "bigint":
      return textSlotType;
  }
  child = child as VNode;
  const { type, props } = child;
  if (props.shown === false) return emptySlotType;
  if (type === Fragment) return fragmentSlotType;
  const typeOfType = typeof type;
  if (typeOfType === "string") return elementSlotType;
  if (ContextSymbol in child) return contextSlotType;
  return componentSlotType;
}

export function getCustomChildKey(
  child: FragmentChild | ComponentChild | ContextChild,
  fallback: number,
): string {
  const { type, props } = child;
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
