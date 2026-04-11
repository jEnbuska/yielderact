/**
 * Child type guards and narrowing helpers.
 *
 * Everything the renderer needs to answer "what kind of thing is this
 * Child?" lives here — the reconciler, the slot builders, and tests all
 * go through these helpers rather than re-testing `typeof` or poking at
 * `vnode.type` inline. Keeping the guards in one file means the full
 * Child/VNode taxonomy is visible at a glance.
 */
import { type Context, isContext } from "./context";
import { type Child, type Component, Fragment, type VNode } from "./jsx";
import type {SlotKey} from "./render/slots";

// ---------------------------------------------------------------------------
// Child-level guards (take the full `Child` union as input)
// ---------------------------------------------------------------------------

/**
 * True when the child produces no DOM at all: `null`, `undefined`, either
 * boolean, or a VNode with `$shown === false`. The reconciler maps these
 * to an `EmptySlot`.
 */
export function isEmptyChild(child: Child): child is null | undefined | boolean {
  if (child == null || typeof child === "boolean") return true;
  if (isVNodeChild(child) && child.props.$shown === false) return true;
  return false;
}

/** True when the child is a text primitive (string or number). */
export function isTextChild(child: Child): child is string | number {
  return typeof child === "string" || typeof child === "number";
}

/** True when the child is a VNode (any flavour — element, component, context, fragment). */
export function isVNodeChild(child: Child): child is VNode {
  return child !== null && child !== undefined && typeof child === "object";
}

// ---------------------------------------------------------------------------
// VNode-level guards (take an already-narrowed VNode)
// ---------------------------------------------------------------------------

/** Narrows a VNode to the Fragment marker. */
export function isFragmentVNode(vnode: VNode): vnode is VNode<typeof Fragment> {
  return vnode.type === Fragment;
}

/** Narrows a VNode to an intrinsic element (`<div>`, `<span>`, ...). */
export function isElementVNode(vnode: VNode): vnode is VNode<string> {
  return typeof vnode.type === "string";
}

/** Narrows a VNode to a context provider (`<Ctx value={...}>`). */
export function isContextVNode(vnode: VNode): vnode is VNode<Context> {
  return typeof vnode.type === "function" && isContext(vnode.type);
}

/**
 * Narrows a VNode to a user-defined generator component. Excludes context
 * providers, which are also functions but carry the `ContextSymbol` tag.
 */
export function isComponentVNode(vnode: VNode): vnode is VNode<Component> {
  return typeof vnode.type === "function" && !isContext(vnode.type);
}

// ---------------------------------------------------------------------------
// Child helpers
// ---------------------------------------------------------------------------

/**
 * The key the reconciler uses to match a child against a previous slot.
 * Falls back to the positional index when the child has no `$key`.
 */
export function getChildKey(child: Child, fallback: SlotKey): SlotKey {
  if (!isVNodeChild(child)) return fallback;
  const key = child.props.$key;
  return key ?? fallback;
}
