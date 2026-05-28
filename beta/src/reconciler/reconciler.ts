import type { Child, Children } from "../jsx";
import type { ComponentFiber } from "../instances/component-fiber";
import type { Slot, SlotType } from "../slots/slot";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";
import type { TagNamespace } from "../render/elements/namespaces";
import { type AnyElement, nodeNameSpace } from "../render/elements/namespaces";
import type { UIAction } from "./actions";
import {
  isRefProps,
  prepareCreate,
  prepareInsert,
  prepareMove,
  prepareRemove,
  prepareText,
  prepareUpdate,
} from "./actions";
import { childrenToIntents, childToIntent, inheritSlot } from "./prepare";
import { getMapValues, getMapValuesReversed } from "../general";
import { deriveStableIndexes } from "./derive-stable-indexes";
import type { ContextMap } from "../render/types";
import { emptyChildren, type SlotIntent } from "../slots/slot-intent";
import { diffElementProps } from "../render/element-props";
import {
  handleCreateNode,
  handleMountSlot,
  handleUpdateRef,
  handleUpdateSlotProps,
} from "./fiber-handlers";

function prepareFiber(fiber: ComponentFiber) {
  const { instances } = fiber;
  fiber.instances = instances?.size ? new Map() : undefined;
  fiber.unmountInstances = instances?.size ? new Set(instances.values()) : undefined;
  fiber.nextRefs = undefined;
  fiber.preparedSlots ??= new Map<string, Slot>();
  return fiber;
}

export function mountFiberChildren(fiber: ComponentFiber, child: Child): Slot {
  const stagingDom = document.createDocumentFragment();
  const { parentDom, ns, ctx } = prepareFiber(fiber);
  const intent = childToIntent(child ?? "");
  mountIntent(fiber, intent, ns, parentDom, stagingDom, ctx);
  fiber.uiActions = [prepareInsert(fiber.parentDom, stagingDom, fiber.tailNode)];
  return intent as Slot;
}

export function reconcileFiberChildren(fiber: ComponentFiber, child: Child): Slot {
  const { parentDom, slot, ns, tailNode, ctx } = prepareFiber(fiber);
  const prevSlot = slot!;
  const intent = childToIntent(child ?? "");
  const uiActions: UIAction[] = (fiber.uiActions = []);
  if (intent.key !== prevSlot.key) {
    uiActions.push(prepareRemove(prevSlot));
    buildIntentToSlot(uiActions, fiber, intent, ns, parentDom, tailNode, ctx);
    return intent as Slot;
  } else {
    const slot = inheritSlot(intent, prevSlot);
    updateSlot(uiActions, fiber, slot, ns, ctx);
    return slot;
  }
}

function mount(
  children: ReadonlyArray<Children>,
  fiber: ComponentFiber,
  parentDom: Node,
  stagingDom: Node,
  parentPath: string,
  ns: TagNamespace,
  ctx: ContextMap,
): ReadonlyMap<string, Slot> {
  const slots = childrenToIntents(children, parentPath) as any as ReadonlyMap<string, Slot>;
  for (const draft of getMapValues(slots)) {
    mountIntent(fiber, draft, ns, parentDom, stagingDom, ctx);
  }
  return slots;
}

function reconcile(
  uiActions: UIAction[],
  fiber: ComponentFiber,
  children: ReadonlyArray<Children> = emptyChildren,
  parentDom: Node,
  path: string,
  oldSlots: ReadonlyMap<string, Slot>,
  ns: TagNamespace,
  beforeNode: Node | null,
  ctx: ContextMap,
): ReadonlyMap<string, Slot> {
  const drafts = childrenToIntents(children, path);
  const stableIndexes = deriveStableIndexes(drafts, oldSlots);
  for (const [key, draft] of drafts) {
    const prev = oldSlots.get(key);
    if (prev === undefined) continue;
    const slot = inheritSlot(draft, prev);
    slot.stable = stableIndexes.has(prev.index);
  }
  for (const slot of getMapValuesReversed(oldSlots)) {
    if (drafts.has(slot.key)) continue;
    uiActions.push(prepareRemove(slot));
  }
  const slots = drafts as ReadonlyMap<string, Slot>;
  for (const slot of getMapValuesReversed(slots)) {
    if (slot.headNode === undefined) {
      // ... SlotIntent
      buildIntentToSlot(uiActions, fiber, slot, ns, parentDom, beforeNode, ctx);
    } else {
      // ... Slot
      updateSlot(uiActions, fiber, slot, ns, ctx);
      if (!slot.stable) uiActions.push(prepareMove(parentDom, slot, beforeNode));
    }
    beforeNode = slot.headNode;
  }
  return slots;
}

function mountIntent(
  fiber: ComponentFiber,
  intent: SlotIntent,
  ns: TagNamespace,
  parentDom: Node,
  stagingDom: Node,
  ctx: ContextMap,
) {
  switch (intent.type) {
    case contextSlotType:
    case componentSlotType: {
      const { headNode, tailNode } = handleMountSlot(fiber, intent, parentDom, ns, ctx);
      stagingDom.appendChild(headNode);
      stagingDom.appendChild(tailNode);
      return;
    }
    case textSlotType: {
      const { headNode } = handleCreateNode(fiber, prepareCreate(intent));
      stagingDom.appendChild(headNode);
      return;
    }
    case elementSlotType: {
      const { headNode } = handleCreateNode(fiber, prepareCreate(intent, ns));
      const { children, path, props } = intent;
      stagingDom.appendChild(headNode);
      ns = nodeNameSpace(headNode as any);
      intent.slots = mount(children, fiber, headNode, headNode, path, ns, ctx);
      if (isRefProps(props)) handleUpdateRef(fiber, intent);
      return;
    }
    case fragmentSlotType: {
      const { headNode, tailNode } = handleCreateNode(fiber, prepareCreate(intent, ns));
      const { path, children } = intent;
      stagingDom.appendChild(headNode);
      intent.slots = mount(children, fiber, parentDom, stagingDom, path, ns, ctx);
      stagingDom.appendChild(tailNode!);
      return;
    }
    default:
      throw new Error(`yract-beta: unknown SlotIntent: ${JSON.stringify(intent satisfies never)}`);
  }
}

function buildIntentToSlot(
  uiActions: UIAction[],
  fiber: ComponentFiber,
  intent: SlotIntent,
  ns: TagNamespace,
  parentDom: Node,
  beforeNode: null | Node,
  ctx: ContextMap,
): asserts intent is Slot {
  switch (intent.type) {
    case componentSlotType:
    case contextSlotType: {
      const { headNode, tailNode } = handleMountSlot(fiber, intent, parentDom, ns, ctx);
      const stagingDom = document.createDocumentFragment();
      stagingDom.appendChild(headNode);
      stagingDom.appendChild(tailNode);
      uiActions.push(prepareInsert(parentDom, stagingDom, beforeNode));
      return;
    }
    case textSlotType: {
      const { headNode } = handleCreateNode(fiber, prepareCreate(intent));
      uiActions.push(prepareInsert(parentDom, headNode, beforeNode));
      return;
    }
    case elementSlotType: {
      const { headNode } = handleCreateNode(fiber, prepareCreate(intent, ns));
      const { children, path } = intent;
      ns = nodeNameSpace(headNode as AnyElement);
      intent.slots = mount(children, fiber, headNode, headNode, path, ns, ctx);
      const { props } = intent;
      if (isRefProps(props)) handleUpdateRef(fiber, intent);
      uiActions.push(prepareInsert(parentDom, headNode, beforeNode));
      return;
    }
    case fragmentSlotType: {
      const { headNode, tailNode } = handleCreateNode(fiber, prepareCreate(intent, ns));
      const { children, path } = intent;
      const stagingDom = document.createDocumentFragment();
      stagingDom.appendChild(headNode);
      intent.slots = mount(children, fiber, parentDom, stagingDom, path, ns, ctx);
      stagingDom.appendChild(tailNode!);
      uiActions.push(prepareInsert(parentDom, stagingDom, beforeNode));
    }
  }
}

function updateSlot<T extends SlotType>(
  uiActions: UIAction[],
  fiber: ComponentFiber,
  slot: Slot<T>,
  ns: TagNamespace,
  ctx: ContextMap,
) {
  switch (slot.type) {
    case contextSlotType:
    case componentSlotType:
      handleUpdateSlotProps(fiber, slot);
      return;
    case textSlotType: {
      const { text } = slot;
      if (text === slot.prevText) return;
      uiActions.push(prepareText(slot));
      return;
    }
    case elementSlotType: {
      const { headNode, children, path, slots, prevProps, props } = slot;
      const ns = nodeNameSpace(headNode);
      slot.slots = reconcile(uiActions, fiber, children, headNode, path, slots, ns, null, ctx);
      const patch = diffElementProps(prevProps, props);
      if (isRefProps(slot.props)) handleUpdateRef(fiber, slot);
      if (patch) uiActions.push(prepareUpdate(slot, patch));
      return;
    }
    case fragmentSlotType: {
      const { tailNode, children, path, slots } = slot;
      const parentDom = tailNode.parentNode;
      if (!parentDom) {
        throw new Error("yract-beta: fragment slot reconciled with detached start anchor");
      }
      slot.slots = reconcile(uiActions, fiber, children, parentDom, path, slots, ns, tailNode, ctx);
      return;
    }
    default:
      throw new Error(`Unhandled update slot ${slot satisfies never}`);
  }
}
