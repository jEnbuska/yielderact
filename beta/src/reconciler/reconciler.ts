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
import { diffElementProps, updateElementProps } from "../render/element-props";
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
import { removeRange } from "./unmount";
import type { OptionalUpdateResult, ReconcileResult, UpdateResult } from "./types";
import { ensureSlotPosition, moveRange } from "./position";
import { createSlotPath, updateResult } from "./utils";
import type { ContextInstance } from "../instances/context-instance";
import { createComponentId } from "../instances/component-id";

export { removeRange } from "./unmount";

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
  const slots: Slot[] = [];
  const nextKeyIndex = new Map<SlotKey, number>();
  // Set true as soon as any slot needs DOM-level (re)positioning: a freshly
  // built slot (not yet inserted) or a reused slot whose new index differs
  // from its previous index. Lets us skip the entire `ensureSlotPositions`
  // walk on the common "text/props-only update, no structural change" path.
  let dirtyPositions = false;

  // Pass 1: reuse or build. Build nextKeyIndex as we go.
  let i = 0;
  for (const child of getIterable(nextChildren)) {
    const idx = i++;
    const key = getChildKey(child, idx);
    const prevIdx = prevKeyIndex.get(key);
    let slot: Slot;
    if (
      prevIdx === undefined ||
      used.has(prevIdx) ||
      !slotMatchesChild(prevSlots[prevIdx]!, child)
    ) {
      const slotPath: SlotPath = createSlotPath(parentPath, key);
      slot = yield* buildSlot(child, idx, key, slotPath, parentInstance, parentDom);
      dirtyPositions = true;
    } else {
      // Reuse prev.slotPath — matching key means the path value is identical,
      // so there's no need to allocate a new array.
      slot = yield* updateSlot(prevSlots[prevIdx]!, child, idx, parentInstance);
      used.add(prevIdx);
      if (prevIdx !== idx) dirtyPositions = true;
    }
    slots.push(slot);
    nextKeyIndex.set(getSlotKey(slot), slots.length - 1);
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
    const first = slotFirstNode(prevSlots[j]!);
    const last = slotLastNode(prevSlots[k - 1]!);
    yield updateResult({
      type: "UPDATE_UI",
      callback: () => removeRange(first, last, parentDom),
    });
    j = k;
  }

  // Pass 3: positioning — yield callbacks only for slots that actually moved.
  // Skip the whole walk when nothing structural changed; surviving slots'
  // DOM positions are unaffected by removals (removeRange just closed the gap).
  if (dirtyPositions) yield* ensureSlotPositions(parentDom, beforeNode, slots);
  return { slots: slots, keyIndex: nextKeyIndex };
}

export function* build(
  nextChildren: IterableChild,
  parentInstance: BaseInstance,
  parentDom: Node,
  beforeNode: Node | null,
  parentPath: SlotPath,
): Generator<OptionalUpdateResult, ReconcileResult, BaseInstance> {
  const slots: Slot[] = [];
  const nextKeyIndex = new Map<SlotKey, number>();

  // Pass 1: build. Build nextKeyIndex as we go.
  let i = 0;
  for (const child of getIterable(nextChildren)) {
    const idx = i++;
    const key = getChildKey(child, idx);
    const slotPath: SlotPath = createSlotPath(parentPath, key);
    const slot = yield* buildSlot(child, idx, key, slotPath, parentInstance, parentDom);
    slots.push(slot);
    nextKeyIndex.set(getSlotKey(slot), slots.length - 1);
  }

  // Pass 3: positioning — yield callbacks only for slots that actually moved.
  // Walk backwards to compute each slot's insertBefore anchor.
  yield* ensureSlotPositions(parentDom, beforeNode, slots);
  return { slots: slots, keyIndex: nextKeyIndex };
}

function* ensureSlotPositions(
  parentDom: Node,
  beforeNode: Node | null,
  slots: Slot[],
): Generator<UpdateResult, void> {
  let anchor: Node | null = beforeNode;
  for (let j = slots.length - 1; j >= 0; j--) {
    const slot = slots[j]!;
    const last = slotLastNode(slot);
    if (last.parentNode !== parentDom || last.nextSibling !== anchor) {
      yield* ensureSlotPosition(slot, parentDom, anchor);
    }
    if (isComponentSlot(slot) || isContextSlot(slot)) anchor = slot.instance.startAnchor;
    else anchor = slot.node;
  }
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
  const { keyIndex, slots } = yield* build(
    vnode.children,
    parentInstance,
    slot.node,
    null,
    slotPath,
  );

  slot.slots = slots;
  slot.keyIndex = keyIndex;
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
    type: "UPDATE_UI",
    callback: () => appendChildren(parentDom, slot.node, slot.endAnchor),
  });
  // Recursively reconcile children between the anchors.
  const { keyIndex, slots } = yield* build(
    children,
    parentInstance,
    parentDom,
    slot.endAnchor,
    slotPath,
  );
  slot.slots = slots;
  slot.keyIndex = keyIndex;
  return slot;
}

function* buildComponent(
  vnode: VNode<Component>,
  index: number,
  key: SlotKey,
  slotPath: SlotPath,
  parentDom: Node,
): Generator<UpdateResult, ComponentSlot, ComponentInstance> {
  const instance = yield* mountInstance(vnode, parentDom, slotPath);
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

function* mountInstance<T extends Component | Context>(
  vnode: VNode<T>,
  parentDom: Node,
  slotPath: SlotPath,
): Generator<UpdateResult, BaseInstance<T>, BaseInstance<T>> {
  slotPath = createSlotPath(slotPath, createComponentId(vnode));
  const instance = yield updateResult({
    type: "MOUNT",
    vnode,
    parentDom,
    slotPath,
  });
  if (instance.parentDom !== parentDom) {
    // Reused instance migrating to a new DOM container — physically relocate
    // the whole subtree (anchors + everything between) so DOM and hook state
    // stay paired. `moveRange` walks `startAnchor.nextSibling` in the old
    // parent up to `endAnchor` and `insertBefore`s the lot into the new one.
    instance.parentDom = parentDom;
    yield updateResult({
      type: "UPDATE_UI",
      callback: () => moveRange(instance.startAnchor, instance.endAnchor, parentDom, null),
    });
  } else {
    // Fresh instance — anchors were just created, not yet attached anywhere.
    yield updateResult({
      type: "UPDATE_UI",
      callback: () => appendChildren(parentDom, instance.startAnchor, instance.endAnchor),
    });
  }
  return instance;
}

function* buildContext(
  vnode: VNode<Context>,
  index: number,
  key: SlotKey,
  slotPath: SlotPath,
  parentDom: Node,
): Generator<UpdateResult, ContextSlot, ContextInstance> {
  const instance = yield* mountInstance(vnode, parentDom, slotPath);
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
        type: "UPDATE_UI",
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
    const patch = diffElementProps(prev.props, child.props);
    if (patch) {
      slot.props = child.props;
      yield updateResult({
        type: "UPDATE_UI",
        callback: () => updateElementProps(prev.node, patch, parent.rctx.delegationRoot),
      });
    }
    slot.slots = childResult.slots;
    slot.keyIndex = childResult.keyIndex;
    return slot;
  }

  if (isComponentSlot(prev) || isContextSlot(prev)) {
    yield updateResult({
      type: "ENSURE_PROPS",
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
