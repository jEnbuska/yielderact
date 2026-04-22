/**
 * Immutable reconciler with yielded DOM callbacks.
 *
 * `reconcile` builds a **new** slot tree without mutating prevSlots or the
 * DOM. The reconciler **yields** `OptionalResult` values — either a
 * `[fn, ...args]` callback tuple or `void`. Callers collect the non-void
 * callbacks and apply them in a single batch via `applyDomUpdate`.
 *
 * Void yields come from `buildElement`, which applies off-DOM callbacks
 * immediately (the element is detached) and yields void to provide
 * scheduling points without forwarding the callback to the caller.
 *
 * Usage:
 * ```ts
 * const gen = reconcile(children, parentInstance, parentDom, null);
 * const callbacks: AnyCallbackResult[] = [];
 * let res = gen.next();
 * while (!res.done) {
 *   if (res.value) callbacks.push(res.value);
 *   res = gen.next();
 * }
 * const { slots, keyIndex } = res.value;
 * // Apply all live-DOM changes in one batch:
 * callbacks.forEach(applyDomUpdate);
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
import type { ComponentInstance } from "../instances/component-instance";
import type { Child, Component, IterableChild, VNode, VNodeProps } from "../jsx";
import { shallowEqual } from "../prop-helpers";
import { updateElementProps } from "../render/element-props";
import type { ComponentSlot, ContextSlot, ElementSlot } from "../render/slots";
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
  type SlotPath,
} from "../render/slots";
import { getIterable } from "../iterable";
import { removeRange, unmountSlot } from "./unmount";
import type { OptionalUpdateResult, ReconcileResult, UpdateResult } from "./types";
import { ensureSlotPosition } from "./position";
import { createSlotPath, updateResult } from "./utils";
import type { ContextInstance } from "../instances/context-instance";

export { unmountSlot, removeRange } from "./unmount";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const emptyProps: VNodeProps = {};

// ---------------------------------------------------------------------------
// reconcile — build new slot tree, yield DOM callbacks
// ---------------------------------------------------------------------------

export function* reconcile(
  nextChildren: IterableChild,
  parentInstance: BaseInstance,
  parentDom: Node,
  beforeNode: Node | null,
  parentPath: SlotPath,
  prevSlots: Slot[] = [],
  prevKeyIndex: Map<SlotKey, number> = new Map(),
): Generator<OptionalUpdateResult, ReconcileResult, BaseInstance> {
  const used = new Set<number>();
  const result: Slot[] = [];
  const nextKeyIndex = new Map<SlotKey, number>();

  // Pass 1: reuse or build. Build nextKeyIndex as we go.
  let i = 0;
  for (const child of getIterable(nextChildren)) {
    const idx = i++;
    const key = getChildKey(child, idx);
    const prevIdx = prevKeyIndex.get(key);
    if (prevIdx !== undefined && !used.has(prevIdx)) {
      const prevSlot = prevSlots[prevIdx]!;
      if (slotMatchesChild(prevSlot, child)) {
        // Reuse prev.slotPath — matching key means the path value is identical,
        // so there's no need to allocate a new array.
        const slot = yield* updateSlot(prevSlot, child, idx, parentInstance);
        used.add(prevIdx);
        result.push(slot);
        nextKeyIndex.set(getSlotKey(slot), result.length - 1);
        continue;
      }
    }
    const slotPath: SlotPath = createSlotPath(parentPath, key);
    const slot = yield* buildSlot(child, idx, key, slotPath, parentInstance, parentDom);
    result.push(slot);
    nextKeyIndex.set(getSlotKey(slot), result.length - 1);
  }

  // Pass 2: removals — mark unmounted + emit one range-remove per run of
  // consecutive unused slots. prevSlots is in DOM order, so a maximal run
  // of indices not present in `used` corresponds to a contiguous sibling
  // range in parentDom. Hook cleanup is deferred to afterRender (leaf-first
  // via reversed scheduler loop).
  for (let j = 0; j < prevSlots.length; ) {
    if (used.has(j)) {
      j++;
      continue;
    }
    let k = j + 1;
    while (k < prevSlots.length && !used.has(k)) k++;
    for (let m = j; m < k; m++) yield* unmountSlot(prevSlots[m]!);
    const first = slotFirstNode(prevSlots[j]!);
    const last = slotLastNode(prevSlots[k - 1]!);
    yield updateResult({
      type: "DOM",
      callback: () => removeRange(first, last, parentDom),
    });
    j = k;
  }

  // Pass 3: positioning — yield callbacks only for slots that actually moved.
  // Walk backwards to compute each slot's insertBefore anchor.
  let anchor: Node | null = beforeNode;
  for (let j = result.length - 1; j >= 0; j--) {
    const slot = result[j]!;
    const last = slotLastNode(slot);
    if (last.parentNode !== parentDom || last.nextSibling !== anchor) {
      yield* ensureSlotPosition(slot, parentDom, anchor);
    }
    if (isComponentSlot(slot) || isContextSlot(slot)) anchor = slot.instance.startAnchor;
    else anchor = slot.node;
  }
  return { slots: result, keyIndex: nextKeyIndex };
}

export function* build(
  nextChildren: IterableChild,
  parentInstance: BaseInstance,
  parentDom: Node,
  beforeNode: Node | null,
  parentPath: SlotPath,
): Generator<OptionalUpdateResult, ReconcileResult, BaseInstance> {
  const result: Slot[] = [];
  const nextKeyIndex = new Map<SlotKey, number>();

  // Pass 1: build. Build nextKeyIndex as we go.
  let i = 0;
  for (const child of getIterable(nextChildren)) {
    const idx = i++;
    const key = getChildKey(child, idx);
    const slotPath: SlotPath = createSlotPath(parentPath, key);
    const slot = yield* buildSlot(child, idx, key, slotPath, parentInstance, parentDom);
    result.push(slot);
    nextKeyIndex.set(getSlotKey(slot), result.length - 1);
  }

  // Pass 3: positioning — yield callbacks only for slots that actually moved.
  // Walk backwards to compute each slot's insertBefore anchor.
  let anchor: Node | null = beforeNode;
  for (let j = result.length - 1; j >= 0; j--) {
    const slot = result[j]!;
    const last = slotLastNode(slot);
    if (last.parentNode !== parentDom || last.nextSibling !== anchor) {
      yield* ensureSlotPosition(slot, parentDom, anchor);
    }
    if (isComponentSlot(slot) || isContextSlot(slot)) anchor = slot.instance.startAnchor;
    else anchor = slot.node;
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
  slotPath: SlotPath,
  parentInstance: BaseInstance,
  parentDom: Node,
): Generator<OptionalUpdateResult, Slot> {
  if (isEmptyChild(child)) {
    return createEmptySlot(index, slotPath);
  }
  if (isTextChild(child)) {
    return createTextSlot(index, child, slotPath);
  }
  if (isIterableChild(child)) {
    return yield* buildFragment(child, index, key, emptyProps, slotPath, parentInstance, parentDom);
  }
  if (isFragmentVNode(child)) {
    return yield* buildFragment(
      child.children,
      index,
      key,
      child.props,
      slotPath,
      parentInstance,
      parentDom,
    );
  }
  if (isElementVNode(child)) {
    return yield* buildElement(child, index, slotPath, parentInstance);
  }
  if (isContextVNode(child)) {
    return yield* buildContext(child, index, key, slotPath, parentDom);
  }
  if (isComponentVNode(child)) {
    return yield* buildComponent(child, index, key, slotPath, parentDom);
  }
  throw new Error(`yract-beta: unknown VNode type ${String(child.type)}`);
}

function* buildElement(
  vnode: VNode<string>,
  index: number,
  slotPath: SlotPath,
  parentInstance: BaseInstance,
): Generator<OptionalUpdateResult, ElementSlot> {
  // Create node + apply props (node is unattached — no visible DOM change).
  const slot = createElementSlot(
    index,
    vnode.type,
    vnode.props,
    parentInstance.rctx.delegationRoot,
    slotPath,
  );
  // Recursively reconcile children INTO the unattached element.
  const gen = build(vnode.children, parentInstance, slot.node, null, slotPath);
  let result = gen.next();
  while (!result.done) {
    if (result.value) {
      switch (result.value.type) {
        case "DOM":
          result.value.callback();
          yield;
          result = gen.next();
          continue;
        case "MOUNT":
        case "SET_PROPS": {
          const instance = yield result.value;
          result = gen.next(instance);
          continue;
        }
        default:
          yield result.value;
          result = gen.next();
          continue;
      }
    }
    result = gen.next();
  }
  slot.slots = result.value.slots;
  slot.keyIndex = result.value.keyIndex;
  return slot;
}

function* buildFragment(
  children: IterableChild,
  index: number,
  key: SlotKey,
  props: VNodeProps,
  slotPath: SlotPath,
  parentInstance: BaseInstance,
  parentDom: Node,
): Generator<OptionalUpdateResult, FragmentSlot> {
  const slot = createFragmentSlot(index, props, slotPath);
  slot.key = key;
  // Anchors must be in the DOM before children can be positioned between them.
  yield updateResult({
    type: "DOM",
    callback: () => appendChildren(parentDom, slot.node, slot.endAnchor),
  });
  // Recursively reconcile children between the anchors.
  const childResult = yield* build(children, parentInstance, parentDom, slot.endAnchor, slotPath);
  slot.slots = childResult.slots;
  slot.keyIndex = childResult.keyIndex;
  return slot;
}

function* buildComponent(
  vnode: VNode<Component>,
  index: number,
  key: SlotKey,
  slotPath: SlotPath,
  parentDom: Node,
): Generator<UpdateResult, ComponentSlot, ComponentInstance> {
  const instance = yield updateResult({
    type: "MOUNT",
    vnode,
    index,
    parentDom,
    slotPath,
  });
  yield updateResult({
    type: "DOM",
    callback: () => appendChildren(parentDom, instance.startAnchor, instance.endAnchor),
  });
  return {
    type: componentSlotType,
    instance: instance as ComponentInstance,
    node: instance.startAnchor,
    props: vnode.props,
    slots: [],
    key,
    index,
    slotPath,
  };
}

function* buildContext(
  vnode: VNode<Context>,
  index: number,
  key: SlotKey,
  slotPath: SlotPath,
  parentDom: Node,
): Generator<UpdateResult, ContextSlot, ContextInstance> {
  const instance = yield updateResult({
    type: "MOUNT",
    vnode,
    index,
    parentDom,
    slotPath,
  });
  yield updateResult({
    type: "DOM",
    callback: () => appendChildren(parentDom, instance.startAnchor, instance.endAnchor),
  });
  return {
    type: contextSlotType,
    instance,
    node: instance.startAnchor,
    props: vnode.props,
    slots: [],
    key,
    index,
    slotPath,
  };
}

// ---------------------------------------------------------------------------
// Update — create new slot from prev + child, yield callbacks for changes
// ---------------------------------------------------------------------------

function* updateFragment(
  prev: FragmentSlot,
  children: IterableChild,
  props: VNodeProps,
  newIndex: number,
  parentInstance: BaseInstance,
): Generator<OptionalUpdateResult, FragmentSlot> {
  const parentDom = prev.node.parentNode;
  if (!parentDom) {
    throw new Error("yract-beta: fragment slot reconciled with detached start anchor");
  }
  // Reuse prev.slotPath — matching key means the path value is unchanged.
  const { slotPath } = prev;
  const { slots, keyIndex } = yield* reconcile(
    children,
    parentInstance,
    parentDom,
    prev.endAnchor,
    slotPath,
    prev.slots,
    prev.keyIndex,
  );
  return {
    ...prev,
    props,
    key: props.key ?? newIndex,
    index: newIndex,
    slots,
    keyIndex,
  };
}

function* updateSlot(
  prev: Slot,
  child: Child,
  index: number,
  parent: BaseInstance,
): Generator<OptionalUpdateResult, Slot> {
  if (isEmptySlot(prev)) {
    if (prev.index === index) return prev;
    return { ...prev, index };
  }

  if (isTextSlot(prev)) {
    const text = String(child);
    if (prev.index === index && prev.props === text) return prev;
    if (text !== prev.props)
      yield updateResult({
        type: "DOM",
        callback: () => {
          prev.node.nodeValue = text;
        },
      });
    return { ...prev, index, props: text };
  }

  if (isFragmentSlot(prev)) {
    if (isIterableChild(child)) {
      return yield* updateFragment(prev, child, emptyProps, index, parent);
    }
    if (!isVNodeChild(child)) {
      throw new Error("yract-beta: fragment slot matched non-iterable, non-VNode child");
    }
    return yield* updateFragment(prev, child.children, child.props, index, parent);
  }

  if (!isVNodeChild(child)) {
    throw new Error("yract-beta: updateSlot reached VNode branch with non-VNode child");
  }

  if (isElementSlot(prev)) {
    const childResult = yield* reconcile(
      child.children,
      parent,
      prev.node,
      null,
      prev.slotPath,
      prev.slots,
      prev.keyIndex,
    );
    const slot: Slot = {
      ...prev,
      key: child.props.key ?? index,
      index,
    };
    if (!shallowEqual(prev.props, child.props)) {
      slot.props = child.props;
      yield updateResult({
        type: "DOM",
        callback: () =>
          updateElementProps(prev.node, prev.props, child.props, parent.rctx.delegationRoot),
      });
    }
    slot.slots = childResult.slots;
    slot.keyIndex = childResult.keyIndex;
    return slot;
  }

  if (isComponentSlot(prev) || isContextSlot(prev)) {
    yield updateResult({
      type: "SET_PROPS",
      instance: prev.instance,
      vnode: child,
    });
    return {
      ...prev,
      props: child.props,
      key: child.props.key ?? index,
      index,
    };
  }
  throw new Error(`yract-beta: unknown Slot type ${String(child.type)}`);
}

// ---------------------------------------------------------------------------
// DOM operations — plain functions yielded as callbacks
// ---------------------------------------------------------------------------

function appendChildren(parent: Node, first: Node, second: Node): void {
  parent.appendChild(first);
  parent.appendChild(second);
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
  if (isFragmentSlot(slot)) return slot.node;
  return slot.node;
}

function slotLastNode(slot: Slot): Node {
  if (isComponentSlot(slot) || isContextSlot(slot)) return slot.instance.endAnchor;
  if (isFragmentSlot(slot)) return slot.endAnchor;
  return slot.node;
}
