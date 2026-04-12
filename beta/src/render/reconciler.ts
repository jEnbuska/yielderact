/**
 * Immutable reconciler with yielded DOM callbacks.
 *
 * `reconcile` builds a **new** slot tree without mutating prevSlots or the
 * DOM. The reconciler **yields** `CallbackResult` tuples — `[fn, ...args]` —
 * that the caller collects into an array and applies later in a single batch.
 *
 * Usage:
 * ```ts
 * const gen = reconcile(children, parentInstance, parentDom, null);
 * const callbacks: AnyCallbackResult[] = [];
 * let res = gen.next();
 * while (!res.done) {
 *   callbacks.push(res.value);
 *   res = gen.next();
 * }
 * const { slots, keyIndex } = res.value;
 * // Later, apply all DOM changes in one batch:
 * applyCallbacks(callbacks);
 * ```
 */
import {
  getChildKey,
  isComponentVNode,
  isContextVNode,
  isElementVNode,
  isEmptyChild,
  isFragmentVNode,
  isIterableChild,
  isTextChild,
  isVNodeChild,
} from "../child";
import type { Context } from "../context";
import type { BaseInstance } from "../instances/base-instance";
import { ComponentInstance } from "../instances/component-instance";
import { ContextInstance } from "../instances/context-instance";
import type { Child, Component, VNode, VNodeProps } from "../jsx";
import { propsWithChildren, shallowEqual } from "../prop-helpers";
import type { DelegationRoot } from "./delegation";
import { type RefLike, updateProps } from "./element-props";
import type { ContextSlot } from "./slots";
import {
  componentSlotType,
  contextSlotType,
  createElementSlot,
  createEmptySlot,
  createFragmentSlot,
  createTextSlot,
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
} from "./slots";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const emptyProps: VNodeProps = {};

export type CallbackResult<TArgs extends any[], C extends (...args: TArgs) => void> = [C, ...TArgs];

export type AnyCallbackResult = CallbackResult<any[], (...args: any[]) => void>;

function cbResult<TArgs extends any[], C extends (...args: TArgs) => void>(
  cb: C,
  ...args: TArgs
): CallbackResult<TArgs, C> {
  return [cb, ...args] as const;
}

export function applyCallbacks(callbacks: readonly AnyCallbackResult[]): void {
  for (const [fn, ...args] of callbacks) {
    fn(...args);
  }
}

export interface ReconcileResult {
  slots: Slot[];
  keyIndex: Map<SlotKey, number>;
}

// ---------------------------------------------------------------------------
// reconcile — build new slot tree, yield DOM callbacks
// ---------------------------------------------------------------------------

export function* reconcile(
  nextChildren: Iterable<Child>,
  parentInstance: BaseInstance,
  parentDom: Node,
  beforeNode: Node | null,
  prevSlots: Slot[] = [],
  prevKeyIndex: Map<SlotKey, number> = new Map(),
): Generator<AnyCallbackResult, ReconcileResult> {
  const used = new Set<number>();
  const result: Slot[] = [];
  const nextKeyIndex = new Map<SlotKey, number>();

  // Pass 1: reuse or build. Build nextKeyIndex as we go.
  let i = 0;
  for (const child of nextChildren) {
    const idx = i++;
    const key = getChildKey(child, idx);
    const prevIdx = prevKeyIndex.get(key);

    if (prevIdx !== undefined && !used.has(prevIdx)) {
      const prevSlot = prevSlots[prevIdx]!;
      if (slotMatchesChild(prevSlot, child)) {
        const slot = yield* updateSlot(prevSlot, child, idx, parentInstance);
        used.add(prevIdx);
        result.push(slot);
        nextKeyIndex.set(getSlotKey(slot), result.length - 1);
        continue;
      }
    }
    const slot = yield* buildSlot(child, idx, key, parentInstance, parentDom);
    result.push(slot);
    nextKeyIndex.set(getSlotKey(slot), result.length - 1);
  }

  // Pass 2: removals — mark unmounted + remove DOM. Hook cleanup is
  // deferred to afterRender (leaf-first via reversed scheduler loop).
  for (let j = 0; j < prevSlots.length; j++) {
    if (used.has(j)) continue;
    const slot = prevSlots[j];
    if (!slot) continue;
    yield cbResult(unmountAndRemove, slot, parentDom);
  }

  // Pass 3: positioning — yield callbacks only for slots that actually moved.
  // Walk backwards to compute each slot's insertBefore anchor.
  let anchor: Node | null = beforeNode;
  for (let j = result.length - 1; j >= 0; j--) {
    const slot = result[j]!;
    const last = slotLastNode(slot);
    if (last.parentNode !== parentDom || last.nextSibling !== anchor) {
      yield cbResult(moveSlotDom, slot, parentDom, anchor);
    }
    anchor = slotFirstNode(slot);
  }

  return { slots: result, keyIndex: nextKeyIndex };
}

// ---------------------------------------------------------------------------
// Build — create new slots, yield DOM callbacks for creation
// ---------------------------------------------------------------------------

function* buildSlot(
  child: Child,
  index: number,
  key: SlotKey,
  parentInstance: BaseInstance,
  parentDom: Node,
): Generator<AnyCallbackResult, Slot> {
  if (isEmptyChild(child)) return createEmptySlot(index);

  if (isTextChild(child)) return createTextSlot(index, child);

  if (isIterableChild(child)) {
    return yield* buildFragment(child, index, key, emptyProps, parentInstance, parentDom);
  }
  if (!isVNodeChild(child)) {
    throw new Error(`yract-beta: unreachable child kind ${String(child)}`);
  }

  if (isFragmentVNode(child)) {
    return yield* buildFragment(child.children, index, key, child.props, parentInstance, parentDom);
  }
  if (isElementVNode(child)) return yield* buildElement(child, index, parentInstance);
  if (isContextVNode(child)) {
    return yield* buildContext(child, index, key, parentInstance, parentDom);
  }
  if (isComponentVNode(child)) {
    return yield* buildComponent(child, index, key, parentInstance, parentDom);
  }

  throw new Error(`yract-beta: unknown VNode type ${String(child.type)}`);
}

function* buildElement(
  vnode: VNode<string>,
  index: number,
  parentInstance: BaseInstance,
): Generator<AnyCallbackResult, Slot> {
  // Create node + apply props (node is unattached — no visible DOM change).
  const slot = createElementSlot(
    index,
    vnode.type,
    vnode.props,
    parentInstance.rctx.delegationRoot,
  );
  // Recursively reconcile children INTO the unattached element.
  const childResult = yield* reconcile(vnode.children, parentInstance, slot.node, null);
  slot.slots = childResult.slots;
  slot.keyIndex = childResult.keyIndex;
  return slot;
}

function* buildFragment(
  children: Iterable<Child>,
  index: number,
  key: SlotKey,
  props: VNodeProps,
  parentInstance: BaseInstance,
  parentDom: Node,
): Generator<AnyCallbackResult, Slot> {
  const slot = createFragmentSlot(index, props);
  slot.key = key;
  // Anchors must be in the DOM before children can be positioned between them.
  yield cbResult(appendChildren, parentDom, slot.node, slot.endAnchor);
  // Recursively reconcile children between the anchors.
  const childResult = yield* reconcile(children, parentInstance, parentDom, slot.endAnchor);
  slot.slots = childResult.slots;
  slot.keyIndex = childResult.keyIndex;
  return slot;
}

function* buildComponent(
  vnode: VNode<Component>,
  index: number,
  key: SlotKey,
  parentInstance: BaseInstance,
  parentDom: Node,
): Generator<AnyCallbackResult, Slot> {
  const instance = new ComponentInstance(
    vnode,
    parentInstance.ctx,
    index,
    parentInstance,
    parentInstance.rctx,
  );
  yield cbResult(appendChildren, parentDom, instance.startAnchor, instance.endAnchor);
  const slot: Slot = {
    type: componentSlotType,
    instance,
    node: instance.startAnchor,
    props: vnode.props,
    slots: [],
    key,
    index,
  };
  instance.scheduleRender();
  return slot;
}

function* buildContext(
  vnode: VNode<Context>,
  index: number,
  key: SlotKey,
  parentInstance: BaseInstance,
  parentDom: Node,
): Generator<AnyCallbackResult, Slot> {
  const instance = new ContextInstance(
    vnode,
    parentInstance.ctx,
    index,
    parentInstance,
    parentInstance.rctx,
  );
  yield cbResult(appendChildren, parentDom, instance.startAnchor, instance.endAnchor);
  const slot: ContextSlot = {
    type: contextSlotType,
    instance,
    node: instance.startAnchor,
    props: vnode.props,
    slots: [],
    key,
    index,
  };
  instance.scheduleRender();
  return slot;
}

// ---------------------------------------------------------------------------
// Update — create new slot from prev + child, yield callbacks for changes
// ---------------------------------------------------------------------------

function* updateFragment(
  prev: FragmentSlot,
  children: Iterable<Child>,
  props: VNodeProps,
  newIndex: number,
  parentInstance: BaseInstance,
): Generator<AnyCallbackResult, Slot> {
  const parentDom = prev.node.parentNode;
  if (!parentDom) {
    throw new Error("yract-beta: fragment slot reconciled with detached start anchor");
  }
  const { slots, keyIndex } = yield* reconcile(
    children,
    parentInstance,
    parentDom,
    prev.endAnchor,
    prev.slots,
    prev.keyIndex,
  );
  return {
    ...prev,
    props,
    key: props.$key ?? newIndex,
    index: newIndex,
    slots,
    keyIndex,
  };
}

function* updateSlot(
  prev: Slot,
  child: Child,
  newIndex: number,
  parentInstance: BaseInstance,
): Generator<AnyCallbackResult, Slot> {
  if (isEmptySlot(prev)) {
    return { ...prev, index: newIndex };
  }

  if (isTextSlot(prev)) {
    const text = String(child);
    const slot: Slot = { ...prev, index: newIndex };
    if (prev.props !== text) {
      slot.props = text;
      yield cbResult(setTextNodeValue, prev.node, text);
    }
    return slot;
  }

  if (isFragmentSlot(prev)) {
    if (isIterableChild(child)) {
      return yield* updateFragment(prev, child, emptyProps, newIndex, parentInstance);
    }
    if (!isVNodeChild(child)) {
      throw new Error("yract-beta: fragment slot matched non-iterable, non-VNode child");
    }
    return yield* updateFragment(prev, child.children, child.props, newIndex, parentInstance);
  }

  if (!isVNodeChild(child)) {
    throw new Error("yract-beta: updateSlot reached VNode branch with non-VNode child");
  }

  if (isElementSlot(prev)) {
    const childResult = yield* reconcile(
      child.children,
      parentInstance,
      prev.node,
      null,
      prev.slots,
      prev.keyIndex,
    );
    const slot: Slot = {
      ...prev,
      key: child.props.$key ?? newIndex,
      index: newIndex,
    };
    if (!shallowEqual(prev.props, child.props)) {
      slot.props = child.props;
      yield cbResult(
        updateElementProps,
        prev.node,
        prev.props,
        child.props,
        parentInstance.rctx.delegationRoot,
      );
    }
    slot.slots = childResult.slots;
    slot.keyIndex = childResult.keyIndex;
    return slot;
  }

  if (isComponentSlot(prev)) {
    prev.instance.setProps(propsWithChildren(child));
    return {
      ...prev,
      props: child.props,
      key: child.props.$key ?? newIndex,
      index: newIndex,
    };
  }

  if (isContextSlot(prev)) {
    prev.instance.setProps(propsWithChildren(child));
    return {
      ...prev,
      props: child.props,
      key: child.props.$key ?? newIndex,
      index: newIndex,
    };
  }

  throw new Error("yract-beta: unreachable slot kind in updateSlot");
}

// ---------------------------------------------------------------------------
// DOM operations — plain functions yielded as callbacks
// ---------------------------------------------------------------------------

function setTextNodeValue(node: Text, text: string): void {
  node.nodeValue = text;
}

function updateElementProps(
  el: HTMLElement,
  oldProps: VNodeProps,
  newProps: VNodeProps,
  delegationRoot: DelegationRoot,
): void {
  updateProps(el, oldProps, newProps, delegationRoot);
}

function appendChildren(parent: Node, first: Node, second: Node): void {
  parent.appendChild(first);
  parent.appendChild(second);
}

function unmountAndRemove(slot: Slot, parentDom: Node): void {
  unmountSlot(slot);
  removeSlotDom(slot, parentDom);
}

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slotMatchesChild<T extends Slot = Slot>(slot: T, child: Child): boolean {
  if (isEmptyChild(child)) return isEmptySlot(slot);
  if (isTextChild(child)) return isTextSlot(slot);
  if (isIterableChild(child)) return isFragmentSlot(slot);
  if (!isVNodeChild(child)) return false;
  if (isFragmentVNode(child)) return isFragmentSlot(slot);
  if (isElementVNode(child)) return isElementSlot(slot) && slot.element === child.type;
  if (isContextVNode(child)) return isContextSlot(slot) && slot.instance.contextKey === child.type;
  if (isComponentVNode(child)) {
    return isComponentSlot(slot) && slot.instance.vnode.type === child.type;
  }
  return false;
}

function slotFirstNode(slot: Slot): Node {
  if (isComponentSlot(slot) || isContextSlot(slot)) return slot.instance.startAnchor;
  return slot.node;
}

function slotLastNode(slot: Slot): Node {
  if (isComponentSlot(slot) || isContextSlot(slot)) return slot.instance.endAnchor;
  if (isFragmentSlot(slot)) return slot.endAnchor;
  return slot.node;
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
  if (slot.node.parentNode === parentDom && slot.node.nextSibling === beforeNode) return;
  parentDom.insertBefore(slot.node, beforeNode);
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
  if (slot.node.parentNode === parentDom) parentDom.removeChild(slot.node);
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

function removeRange(first: Node, last: Node, parent: Node): void {
  let cur: Node | null = first;
  while (cur) {
    const next: Node | null = cur === last ? null : cur.nextSibling;
    if (cur.parentNode === parent) parent.removeChild(cur);
    cur = next;
  }
}
