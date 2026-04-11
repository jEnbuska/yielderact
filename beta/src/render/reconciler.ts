/**
 * reconcileChildren — the single diff/patch routine.
 *
 * All diffing is derived from (prevSlots × nextChildren). We never read from
 * the DOM — the slot tree is the single source of truth for what the DOM
 * currently contains. DOM writes happen inline as slots are built,
 * updated, moved, or removed.
 *
 * Algorithm:
 *   1. Key → prev-index lookup from `prevSlots`.
 *   2. Walk `nextChildren`: reuse a matching prev slot (same key + same
 *      shape) via in-place update, or build a new slot via the factories
 *      in slots.ts.
 *   3. Unmount any prev slots that were not reused.
 *   4. Positioning pass (walk result in reverse, `insertBefore`) that
 *      moves each slot into its final DOM position. Works uniformly for
 *      single-node slots (text/empty/element) and range slots
 *      (fragment / component / context) via `slotFirstNode` + moveRange.
 *
 * Child instances are created with the enclosing `parentInstance` as their
 * `parent`, so the instance tree mirrors ownership (not DOM structure):
 * a component at any depth inside an element still belongs to the nearest
 * enclosing component/context/root instance for unmount cascades.
 */
import {
  getChildKey,
  isComponentVNode,
  isContextVNode,
  isElementVNode,
  isEmptyChild,
  isFragmentVNode,
  isTextChild,
  isVNodeChild,
} from "../child";
import type { Child, VNode } from "../jsx";
import { propsWithChildren, shallowEqual } from "../prop-helpers";
import type { BaseInstance } from "../instances/base-instance";
import { ComponentInstance } from "../instances/component-instance";
import { ContextInstance } from "../instances/context-instance";
import { type RefLike, updateProps } from "./element-props";
import {
  type ComponentSlot,
  componentSlotType,
  type ContextSlot,
  contextSlotType,
  createElementSlot,
  createEmptySlot,
  createFragmentSlot,
  createTextSlot,
  type ElementSlot,
  type FragmentSlot,
  getSlotKey,
  isComponentSlot,
  isContextSlot,
  isElementSlot,
  isEmptySlot,
  isFragmentSlot,
  isTextSlot,
  type Slot,
  type SlotKey,
  type TextSlot,
} from "./slots";

/**
 * Reconcile `nextChildren` into `prevSlots` as children of `parentDom`.
 * `parentInstance` is the enclosing component/context/root instance that
 * owns newly-created child instances and provides `ctx` + `rctx`.
 * `beforeNode` is the `insertBefore` anchor marking the end of this slot
 * range (null = append to parentDom).
 */
export function reconcileChildren(
  parentInstance: BaseInstance,
  parentDom: Node,
  prevSlots: Slot[],
  nextChildren: Child[],
  beforeNode: Node | null,
): Slot[] {
  const prevByKey = buildKeyIndex(prevSlots);
  const used = new Set<number>();
  const result: Slot[] = [];

  // Pass 1: reuse or build.
  for (let i = 0; i < nextChildren.length; i++) {
    const child = nextChildren[i] as Child;
    const key = getChildKey(child, i);
    const prevIdx = prevByKey.get(key);

    if (prevIdx !== undefined && !used.has(prevIdx)) {
      const prev = prevSlots[prevIdx];
      if (prev !== undefined && slotMatchesChild(prev, child)) {
        updateSlotInPlace(parentInstance, prev, child, i);
        used.add(prevIdx);
        result.push(prev);
        continue;
      }
    }
    result.push(buildSlot(parentInstance, parentDom, child, i, key));
  }

  // Pass 2: unmount prev slots that were not reused.
  for (let i = 0; i < prevSlots.length; i++) {
    if (used.has(i)) continue;
    const slot = prevSlots[i];
    if (!slot) continue;
    unmountSlot(slot);
    removeSlotDom(slot, parentDom);
  }

  // Pass 3: positioning — walk in reverse so each slot is inserted before
  // the one we just positioned.
  let anchor: Node | null = beforeNode;
  for (let i = result.length - 1; i >= 0; i--) {
    const slot = result[i];
    if (!slot) continue;
    moveSlotDom(slot, parentDom, anchor);
    anchor = slotFirstNode(slot);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Key index + slot-match dispatch
// ---------------------------------------------------------------------------

function buildKeyIndex(prevSlots: Slot[]): Map<SlotKey, number> {
  const map = new Map<SlotKey, number>();
  for (let i = 0; i < prevSlots.length; i++) {
    const slot = prevSlots[i];
    if (!slot) continue;
    map.set(getSlotKey(slot), i);
  }
  return map;
}

function slotMatchesChild(slot: Slot, child: Child): boolean {
  if (isEmptyChild(child)) return isEmptySlot(slot);
  if (isTextChild(child)) return isTextSlot(slot);
  if (!isVNodeChild(child)) return false;

  if (isFragmentVNode(child)) return isFragmentSlot(slot);
  if (isElementVNode(child)) return isElementSlot(slot) && slot.element === child.type;
  if (isContextVNode(child)) return isContextSlot(slot) && slot.instance.contextKey === child.type;
  if (isComponentVNode(child)) return isComponentSlot(slot) && slot.instance.vnode.type === child.type;
  return false;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function buildSlot(
  parentInstance: BaseInstance,
  parentDom: Node,
  child: Child,
  index: number,
  key: SlotKey,
): Slot {
  if (isEmptyChild(child)) return createEmptySlot(index);
  if (isTextChild(child)) return createTextSlot(index, child);
  if (!isVNodeChild(child)) {
    throw new Error(`yract-beta: unreachable child kind ${String(child)}`);
  }

  if (isFragmentVNode(child)) return buildFragmentSlot(parentInstance, parentDom, child, index, key);
  if (isElementVNode(child)) return buildElementSlotWith(parentInstance, child, index);
  if (isContextVNode(child)) return buildContextSlot(parentInstance, parentDom, child, index, key);
  if (isComponentVNode(child)) return buildComponentSlot(parentInstance, parentDom, child, index, key);

  throw new Error(`yract-beta: unknown VNode type ${String(child.type)}`);
}

function buildElementSlotWith(
  parentInstance: BaseInstance,
  vnode: VNode,
  index: number,
): ElementSlot {
  const slot = createElementSlot(
    index,
    vnode.type as string,
    vnode.props,
    parentInstance.rctx.delegationRoot,
  );
  // Recursively reconcile the element's children INTO the element.
  slot.slots = reconcileChildren(parentInstance, slot.node, [], vnode.children, null);
  return slot;
}

function buildFragmentSlot(
  parentInstance: BaseInstance,
  parentDom: Node,
  vnode: VNode,
  index: number,
  key: SlotKey,
): FragmentSlot {
  const slot = createFragmentSlot(index, vnode.props);
  slot.key = key;
  // Place anchors in the parent DOM so children reconcile into the range
  // between them. The positioning pass may later move the whole range.
  parentDom.appendChild(slot.node);
  parentDom.appendChild(slot.endAnchor);
  slot.slots = reconcileChildren(parentInstance, parentDom, [], vnode.children, slot.endAnchor);
  return slot;
}

function buildComponentSlot(
  parentInstance: BaseInstance,
  parentDom: Node,
  vnode: VNode,
  index: number,
  key: SlotKey,
): ComponentSlot {
  const instance = new ComponentInstance(
    vnode,
    parentInstance.ctx,
    index,
    parentInstance,
    parentInstance.rctx,
  );
  parentDom.appendChild(instance.startAnchor);
  parentDom.appendChild(instance.endAnchor);
  instance.scheduleRender();
  return {
    type: componentSlotType,
    instance,
    node: instance.startAnchor,
    props: vnode.props,
    slots: [],
    key,
    index,
  };
}

function buildContextSlot(
  parentInstance: BaseInstance,
  parentDom: Node,
  vnode: VNode,
  index: number,
  key: SlotKey,
): ContextSlot {
  const instance = new ContextInstance(
    vnode,
    parentInstance.ctx,
    index,
    parentInstance,
    parentInstance.rctx,
  );
  parentDom.appendChild(instance.startAnchor);
  parentDom.appendChild(instance.endAnchor);
  instance.scheduleRender();
  return {
    type: contextSlotType,
    instance,
    node: instance.startAnchor,
    props: vnode.props,
    slots: [],
    key,
    index,
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

function updateSlotInPlace(
  parentInstance: BaseInstance,
  slot: Slot,
  child: Child,
  newIndex: number,
): void {
  slot.index = newIndex;

  if (isEmptySlot(slot)) return;
  if (isTextSlot(slot)) {
    updateTextSlot(slot, child);
    return;
  }
  // From slotMatchesChild we know child is a VNode from here on.
  const vnode = child as VNode;
  if (isElementSlot(slot)) {
    updateElementSlot(parentInstance, slot, vnode, newIndex);
    return;
  }
  if (isFragmentSlot(slot)) {
    updateFragmentSlot(parentInstance, slot, vnode, newIndex);
    return;
  }
  if (isComponentSlot(slot)) {
    updateComponentSlot(slot, vnode, newIndex);
    return;
  }
  if (isContextSlot(slot)) {
    updateContextSlot(slot, vnode, newIndex);
    return;
  }
}

function updateTextSlot(slot: TextSlot, child: Child): void {
  const text = String(child);
  if (slot.props === text) return;
  (slot.node as Text).nodeValue = text;
  slot.props = text;
}

function updateElementSlot(
  parentInstance: BaseInstance,
  slot: ElementSlot,
  vnode: VNode,
  newIndex: number,
): void {
  if (!shallowEqual(slot.props, vnode.props)) {
    updateProps(
      slot.node as HTMLElement,
      slot.props,
      vnode.props,
      parentInstance.rctx.delegationRoot,
    );
    slot.props = vnode.props;
  }
  slot.key = vnode.props.$key ?? newIndex;
  slot.slots = reconcileChildren(parentInstance, slot.node, slot.slots, vnode.children, null);
}

function updateFragmentSlot(
  parentInstance: BaseInstance,
  slot: FragmentSlot,
  vnode: VNode,
  newIndex: number,
): void {
  slot.props = vnode.props;
  slot.key = vnode.props.$key ?? newIndex;
  const parentDom = slot.node.parentNode;
  if (!parentDom) {
    throw new Error("yract-beta: fragment slot reconciled with detached start anchor");
  }
  slot.slots = reconcileChildren(parentInstance, parentDom, slot.slots, vnode.children, slot.endAnchor);
}

function updateComponentSlot(slot: ComponentSlot, vnode: VNode, newIndex: number): void {
  slot.props = vnode.props;
  slot.key = vnode.props.$key ?? newIndex;
  slot.instance.setProps(propsWithChildren(vnode));
}

function updateContextSlot(slot: ContextSlot, vnode: VNode, newIndex: number): void {
  slot.props = vnode.props;
  slot.key = vnode.props.$key ?? newIndex;
  slot.instance.setProps(propsWithChildren(vnode));
}

// ---------------------------------------------------------------------------
// Unmount / DOM helpers
// ---------------------------------------------------------------------------

export function unmountSlot(slot: Slot): void {
  if (isComponentSlot(slot) || isContextSlot(slot)) {
    slot.instance.unmount();
    return;
  }
  if (isElementSlot(slot)) {
    const ref = slot.props["$ref"] as RefLike | undefined;
    if (ref) ref.current = undefined;
    for (const child of slot.slots) unmountSlot(child);
    return;
  }
  if (isFragmentSlot(slot)) {
    for (const child of slot.slots) unmountSlot(child);
    return;
  }
  // empty / text — nothing to tear down.
}

function removeSlotDom(slot: Slot, parentDom: Node): void {
  if (isComponentSlot(slot) || isContextSlot(slot)) {
    removeRange(slot.instance.startAnchor, slot.instance.endAnchor, parentDom);
    return;
  }
  if (isFragmentSlot(slot)) {
    removeRange(slot.node, slot.endAnchor, parentDom);
    return;
  }
  if (slot.node.parentNode === parentDom) {
    parentDom.removeChild(slot.node);
  }
}

function moveSlotDom(slot: Slot, parentDom: Node, beforeNode: Node | null): void {
  if (isComponentSlot(slot) || isContextSlot(slot)) {
    moveRange(slot.instance.startAnchor, slot.instance.endAnchor, parentDom, beforeNode);
    return;
  }
  if (isFragmentSlot(slot)) {
    moveRange(slot.node, slot.endAnchor, parentDom, beforeNode);
    return;
  }
  // Skip the move if the node is already in the right position. Without
  // this guard, `insertBefore` removes-and-reinserts the node every render,
  // which drops focus on input elements and triggers needless DOM mutation.
  if (slot.node.parentNode === parentDom && slot.node.nextSibling === beforeNode) {
    return;
  }
  parentDom.insertBefore(slot.node, beforeNode);
}

function slotFirstNode(slot: Slot): Node {
  if (isComponentSlot(slot) || isContextSlot(slot)) return slot.instance.startAnchor;
  return slot.node;
}

function moveRange(
  first: Node,
  last: Node,
  parent: Node,
  beforeNode: Node | null,
): void {
  // Skip if the entire range is already in the right place: `first` is in
  // `parent` and `last.nextSibling === beforeNode`. Otherwise re-inserting
  // each node would needlessly disturb focus and trigger DOM churn.
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
  for (const node of nodes) {
    parent.insertBefore(node, beforeNode);
  }
}

function removeRange(first: Node, last: Node, parent: Node): void {
  let cur: Node | null = first;
  while (cur) {
    const next: Node | null = cur === last ? null : cur.nextSibling;
    if (cur.parentNode === parent) parent.removeChild(cur);
    cur = next;
  }
}
