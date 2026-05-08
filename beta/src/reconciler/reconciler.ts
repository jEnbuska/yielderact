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
  assertIsVNodeChild,
  getChildKey,
  isComponentChild,
  isContextChild,
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
import type { Child, Component, IterableChildren, VNode, VNodeProps } from "../jsx";
import { diffElementProps, updateElementProps } from "../render/element-props";
import { getIterable } from "../iterable";
import { removeRange } from "./unmount";
import { mount } from "./mount";
import type { OptionalDelegationAction, ReconcileResult, DelegationAction } from "./types";
import { moveRange, placeNode, appendChildren } from "./position";
import {
  createSlotPath,
  emptyProps,
  isRefProps,
  $delegateProps,
  $delegateMount,
  $delegateRef,
  $delegateUi,
} from "./utils";
import type { ContextInstance } from "../instances/context-instance";
import { createComponentId } from "../instances/component-id";
import { stage, stageInvokeAll } from "../general";
import {
  createElementSlot,
  createEmptySlot,
  createFragmentSlot,
  createTextSlot,
} from "../slots/create";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  emptySlotType,
  fragmentSlotType,
  textSlotType,
} from "../slots/type";
import type {
  ComponentSlot,
  ContextSlot,
  ElementSlot,
  FragmentSlot,
  Slot,
  TextSlot,
} from "../slots/slot";
import { getSlotKey } from "../slots/utils";
import type { SlotKey, SlotPath } from "../slots/general";
import type { TagNamespace } from "../render/elements/namespaces";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// reconcile — build new slot tree, yield DOM callbacks
// ---------------------------------------------------------------------------

export function* reconcile(
  nextChildren: IterableChildren,
  parentInstance: BaseInstance,
  parentDom: Node,
  beforeNode: Node | null,
  parentPath: SlotPath,
  prevSlots: Slot[] = [],
  prevKeyIndex: Map<SlotKey, number> = new Map(),
  ns: TagNamespace,
): Generator<OptionalDelegationAction, ReconcileResult, BaseInstance> {
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
      slot = yield* buildSlot(child, idx, key, slotPath, parentInstance, parentDom, ns);
      dirtyPositions = true;
    } else {
      // Reuse prev.slotPath — matching key means the path value is identical,
      // so there's no need to allocate a new array.
      slot = yield* updateSlot(prevSlots[prevIdx]!, child, idx, parentInstance, ns);
      used.add(prevIdx);
      if (prevIdx !== idx) dirtyPositions = true;
    }
    slots.push(slot);
    nextKeyIndex.set(getSlotKey(slot), slots.length - 1);
  }

  yield* removeUnmountedSlots(prevSlots, used);

  // Pass 3: positioning — yield callbacks only for slots that actually moved.
  // Skip the whole walk when nothing structural changed; surviving slots'
  // DOM positions are unaffected by removals (removeRange just closed the gap).
  if (dirtyPositions) yield* ensureSlotPositions(parentDom, beforeNode, slots);
  return { slots: slots, keyIndex: nextKeyIndex };
}

// Pass 2 of `reconcile`: remove unused prev slots. Walks `prevSlots` in DOM
// order and emits one batched `Range.deleteContents()` callback per maximal
// run of consecutive unused indices — `prevSlots` is DOM-ordered, so a run
// of unused indices corresponds to a contiguous sibling range. Hook cleanup
// is deferred to afterRender (leaf-first via reversed scheduler loop).
function* removeUnmountedSlots(
  prevSlots: Slot[],
  used: Set<number>,
): Generator<DelegationAction | void, void> {
  const ops: Array<() => void> = [];
  for (let from = 0; from < prevSlots.length; ) {
    if (used.has(from)) {
      from++;
      continue;
    }
    let to = from + 1;
    while (to < prevSlots.length && !used.has(to)) to++;
    const first = slotFirstNode(prevSlots[from]!);
    const last = slotLastNode(prevSlots[to - 1]!);
    ops.push(stage(removeRange, first, last));
    from = to;
    yield;
  }
  if (!ops.length) return;
  yield $delegateUi(stageInvokeAll(ops));
}

function* ensureSlotPositions(
  parentDom: Node,
  beforeNode: Node | null,
  slots: Slot[],
): Generator<DelegationAction, void> {
  const ops: Array<() => void> = [];
  let anchor: Node | null = beforeNode;
  for (let j = slots.length - 1; j >= 0; j--) {
    const slot = slots[j]!;
    const last = slotLastNode(slot);
    if (last.parentNode !== parentDom || last.nextSibling !== anchor) {
      const target = anchor;
      switch (slot.type) {
        case componentSlotType:
        case contextSlotType:
          ops.push(
            stage(moveRange, slot.instance.startAnchor, slot.instance.endAnchor, parentDom, target),
          );
          break;
        case fragmentSlotType:
          ops.push(stage(moveRange, slot.node, slot.endAnchor, parentDom, target));
          break;
        default:
          ops.push(stage(placeNode, parentDom, slot.node, target));
          break;
      }
    }
    anchor = slotFirstNode(slot);
  }
  if (!ops.length) return;
  yield $delegateUi(stageInvokeAll(ops));
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
  ns: TagNamespace,
): Generator<OptionalDelegationAction, Slot> {
  if (isEmptyChild(child)) {
    return createEmptySlot(index, slotPath);
  }
  if (isTextChild(child)) {
    return createTextSlot(index, child, slotPath);
  }
  if (isIterableChild(child)) {
    return yield* buildFragment(
      child,
      index,
      key,
      emptyProps,
      slotPath,
      parentInstance,
      parentDom,
      ns,
    );
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
      ns,
    );
  }
  if (isElementVNode(child)) {
    return yield* buildElement(child, index, slotPath, parentInstance, ns);
  }
  if (isContextChild(child)) {
    return yield* buildContext(child, index, key, slotPath, parentDom, ns);
  }
  if (isComponentChild(child)) {
    return yield* buildComponent(child, index, key, slotPath, parentDom, ns);
  }
  throw new Error(`yract-beta: unknown VNode type ${String(child.type)}`);
}

function* buildElement(
  vnode: VNode<string>,
  index: number,
  slotPath: SlotPath,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, ElementSlot> {
  // Create node + apply props (node is unattached — no visible DOM change).
  const slot = createElementSlot(index, vnode, parentInstance.rctx.delegationRoot, slotPath, ns);
  // Children mount directly INTO the detached element via sync `appendChild` —
  // since `slot.node` is unattached, the eager mutations don't affect live DOM
  // and we skip the per-child positioning queue that `build` would emit.
  const { keyIndex, slots } = yield* mount(
    vnode.children,
    parentInstance,
    slot.node,
    slot.node,
    slotPath,
    slot.ns,
  );
  if (isRefProps(vnode.props)) yield $delegateRef(slot.node, vnode.props.ref);
  slot.slots = slots;
  slot.keyIndex = keyIndex;
  return slot;
}

function* buildFragment(
  children: IterableChildren,
  index: number,
  key: SlotKey,
  props: VNodeProps,
  slotPath: SlotPath,
  parentInstance: BaseInstance,
  parentDom: Node,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, FragmentSlot> {
  const slot = createFragmentSlot(index, props, slotPath);
  slot.key = key;
  const stagingDom = document.createDocumentFragment();
  // Anchors must be in the DOM before children can be positioned between them.
  yield $delegateUi(appendChildren(parentDom, stagingDom));
  stagingDom.appendChild(slot.node);
  // Recursively reconcile children between the anchors.
  const { keyIndex, slots } = yield* mount(
    children,
    parentInstance,
    parentDom,
    stagingDom,
    slotPath,
    ns,
  );

  stagingDom.appendChild(slot.endAnchor);

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
  ns: TagNamespace,
): Generator<DelegationAction, ComponentSlot, ComponentInstance> {
  const instance = yield* mountInstance(vnode, parentDom, slotPath, ns);
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
  ns: TagNamespace,
): Generator<DelegationAction, BaseInstance<T>, BaseInstance<T>> {
  slotPath = createSlotPath(slotPath, createComponentId(vnode));
  const instance = yield $delegateMount(vnode, slotPath, parentDom, ns);
  if (instance.parentDom !== parentDom) {
    // Reused instance migrating to a new DOM container — physically relocate
    // the whole subtree (anchors + everything between) so DOM and hook state
    // stay paired. `moveRange` walks `startAnchor.nextSibling` in the old
    // parent up to `endAnchor` and `insertBefore`s the lot into the new one.
    instance.parentDom = parentDom;
    yield $delegateUi(stage(moveRange, instance.startAnchor, instance.endAnchor, parentDom, null));
  } else {
    // Fresh instance — anchors were just created, not yet attached anywhere.
    yield $delegateUi(stage(appendChildren, parentDom, instance.startAnchor, instance.endAnchor));
  }
  return instance;
}

function* buildContext(
  vnode: VNode<Context>,
  index: number,
  key: SlotKey,
  slotPath: SlotPath,
  parentDom: Node,
  ns: TagNamespace,
): Generator<DelegationAction, ContextSlot, ContextInstance> {
  const instance = yield* mountInstance(vnode, parentDom, slotPath, ns);
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
  children: IterableChildren,
  props: VNodeProps,
  newIndex: number,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, FragmentSlot> {
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
    ns,
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
  ns: TagNamespace,
): Generator<OptionalDelegationAction, Slot> {
  switch (prev.type) {
    case emptySlotType:
      if (prev.index === index) return prev;
      return { ...prev, index };
    case textSlotType: {
      const text = String(child);
      if (prev.index === index && prev.props === text) return prev;
      if (text !== prev.props) yield $delegateUi(stageSetText(prev, text));
      return { ...prev, index, props: text };
    }
    case elementSlotType: {
      assertIsVNodeChild(child);
      const childResult = yield* reconcile(
        child.children,
        parent,
        prev.node,
        null,
        prev.slotPath,
        prev.slots,
        prev.keyIndex,
        prev.ns,
      );
      const slot: Slot = {
        ...prev,
        key: child.props.key ?? index,
        index,
      };
      const patch = diffElementProps(prev.props, child.props);
      if (isRefProps(child.props)) {
        yield $delegateRef(slot.node, child.props.ref);
      }
      if (patch) {
        slot.props = child.props;
        yield $delegateUi(stage(updateElementProps, prev.node, patch, parent.rctx.delegationRoot));
      }
      slot.slots = childResult.slots;
      slot.keyIndex = childResult.keyIndex;
      return slot;
    }
    case componentSlotType:
    case contextSlotType:
      assertIsVNodeChild(child);
      yield $delegateProps(prev.instance, child);
      return {
        ...prev,
        props: child.props,
        key: child.props.key ?? index,
        index,
      };
    case fragmentSlotType:
      if (isIterableChild(child)) {
        return yield* updateFragment(prev, child, emptyProps, index, parent, ns);
      }
      assertIsVNodeChild(child);
      return yield* updateFragment(prev, child.children, child.props, index, parent, ns);
    default:
      throw new Error(`yract-beta: unknown Slot type ${String(prev satisfies never)}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slotMatchesChild<T extends Slot = Slot>(slot: T, child: Child): boolean {
  switch (slot.type) {
    case emptySlotType:
      return isEmptyChild(child);
    case textSlotType:
      return isTextChild(child);
    case elementSlotType:
      return isElementVNode(child) && slot.element === child.type;
    case componentSlotType:
      return isComponentChild(child) && slot.instance.vnode.type === child.type;
    case contextSlotType:
      return isContextChild(child) && slot.instance.contextKey === child.type;
    case fragmentSlotType:
      return isIterableChild(child) || (isVNodeChild(child) && isFragmentVNode(child));
    default:
      throw new Error(`yract-beta: unknown Slot type ${String(slot satisfies never)}`);
  }
}

function slotFirstNode(slot: Slot): Node {
  switch (slot.type) {
    case componentSlotType:
    case contextSlotType:
      return slot.instance.startAnchor;
    default:
      return slot.node;
  }
}

function slotLastNode(slot: Slot): Node {
  switch (slot.type) {
    case componentSlotType:
    case contextSlotType:
      return slot.instance.endAnchor;
    case fragmentSlotType:
      return slot.endAnchor;
    default:
      return slot.node;
  }
}

function stageSetText(slot: TextSlot, text: string) {
  return function setText() {
    slot.node.nodeValue = text;
  };
}

function* initialSlotsIterable(slots: Slot[]): Generator<Node, void, void> {
  for (const slot of slots) {
    switch (slot.type) {
      case componentSlotType:
      case contextSlotType:
        yield slot.instance.startAnchor;
        yield slot.instance.endAnchor;
        continue;
      case fragmentSlotType:
        yield slot.node;
        yield* initialSlotsIterable(slot.slots);
        yield slot.endAnchor;
        continue;
      default:
        yield slot.node;
    }
  }
}
