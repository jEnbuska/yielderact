import type { Child, Component, IterableChildren, VNode, VNodeProps } from "../jsx";
import type { BaseInstance } from "../instances/base-instance";
import { getIterable } from "../iterable";
import {
  getChildKey,
  isComponentVNode,
  isContextVNode,
  isElementVNode,
  isEmptyChild,
  isFragmentVNode,
  isIterableChild,
  isTextChild,
} from "../child";
import { createSlotPath, updateResult } from "./utils";
import type { OptionalUpdateResult } from "./types";
import type { Context } from "yract-beta";
import {
  createComponentSlot,
  createContextSlot,
  createElementSlot,
  createEmptySlot,
  createFragmentSlot,
  createTextSlot,
} from "../slots/create";
import { componentSlotType, contextSlotType } from "../slots/type";
import type { ComponentSlot, ContextSlot, ElementSlot, FragmentSlot, Slot } from "../slots/slot";
import { getSlotKey } from "../slots/utils";
import type { SlotKey, SlotPath } from "../slots/general";

const emptyProps: VNodeProps = {};

export function* mount(
  nextChildren: IterableChildren,
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  parentPath: SlotPath,
) {
  const slots: Slot[] = [];
  const keyIndex = new Map<SlotKey, number>();

  let i = 0;
  for (const child of getIterable(nextChildren)) {
    const idx = i++;
    const slotPath: SlotPath = createSlotPath(parentPath, getChildKey(child, idx));
    const slot = yield* mountSlot(child, idx, slotPath, parentInstance, parentDom, stagingDom);
    slots.push(slot);
    keyIndex.set(getSlotKey(slot), slots.length - 1);
    yield;
  }
  return { slots, keyIndex };
}

function* mountSlot(
  child: Child,
  index: number,
  slotPath: SlotPath,
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
): Generator<OptionalUpdateResult, Slot> {
  if (isEmptyChild(child)) {
    return mountEmptySlot(stagingDom, index, slotPath);
  }
  if (isTextChild(child)) {
    return mountTextSlot(stagingDom, index, slotPath, child);
  }
  if (isIterableChild(child)) {
    return yield* mountFragmentSlot(
      parentDom,
      stagingDom,
      index,
      slotPath,
      emptyProps,
      child,
      parentInstance,
    );
  }
  if (isFragmentVNode(child)) {
    return yield* mountFragmentSlot(
      parentDom,
      stagingDom,
      index,
      slotPath,
      child.props,
      child.children,
      parentInstance,
    );
  }
  if (isElementVNode(child)) {
    return yield* mountElementSlot(stagingDom, index, slotPath, child, parentInstance);
  }
  if (isContextVNode(child)) {
    return yield* mountContextSlot(parentDom, stagingDom, index, slotPath, child);
  }
  if (isComponentVNode(child)) {
    return yield* mountComponentSlot(parentDom, stagingDom, index, slotPath, child);
  }
  throw new Error(`yract-beta: unknown VNode type ${String(child.type)}`);
}

function mountEmptySlot(stagingDom: Node, index: number, slotPath: SlotPath) {
  const slot = createEmptySlot(index, slotPath);
  stagingDom.appendChild(slot.node);
  return slot;
}

function mountTextSlot(
  stagingDom: Node,
  index: number,
  slotPath: SlotPath,
  child: number | string,
) {
  const slot = createTextSlot(index, child, slotPath);
  stagingDom.appendChild(slot.node);
  return slot;
}

function* mountFragmentSlot(
  parentDom: Node,
  stagingDom: Node,
  index: number,
  slotPath: SlotPath,
  props: VNodeProps,
  children: IterableChildren,
  parentInstance: BaseInstance,
): Generator<OptionalUpdateResult, FragmentSlot> {
  const slot = createFragmentSlot(index, props, slotPath);
  stagingDom.appendChild(slot.node);
  // Children stage alongside the fragment's anchors but their `instance.parentDom`
  // tracks the real outer parent — when the staging fragment commits, the children's
  // anchors land as siblings inside the real parent.
  const { keyIndex, slots } = yield* mount(
    children,
    parentInstance,
    parentDom,
    stagingDom,
    slotPath,
  );
  stagingDom.appendChild(slot.endAnchor);
  slot.slots = slots;
  slot.keyIndex = keyIndex;
  return slot;
}

function* mountElementSlot(
  stagingDom: Node,
  index: number,
  slotPath: SlotPath,
  child: VNode<string>,
  parentInstance: BaseInstance,
): Generator<OptionalUpdateResult, ElementSlot> {
  const slot = createElementSlot(index, child, parentInstance.rctx.delegationRoot, slotPath);
  stagingDom.appendChild(slot.node);
  // Element children live inside the element — both logical parent and staging
  // target collapse to `slot.node` for the recursion.
  const { keyIndex, slots } = yield* mount(
    child.children,
    parentInstance,
    slot.node,
    slot.node,
    slotPath,
  );
  slot.slots = slots;
  slot.keyIndex = keyIndex;
  return slot;
}

function* mountContextSlot(
  parentDom: Node,
  stagingDom: Node,
  index: number,
  slotPath: SlotPath,
  vnode: VNode<Context>,
): Generator<OptionalUpdateResult, ContextSlot, BaseInstance<Context>> {
  const instance = yield updateResult({
    type: "MOUNT",
    vnode,
    parentDom,
    slotPath,
  });
  stagingDom.appendChild(instance.startAnchor);
  stagingDom.appendChild(instance.endAnchor);
  return createContextSlot(index, instance, slotPath);
}

function* mountComponentSlot(
  parentDom: Node,
  stagingDom: Node,
  index: number,
  slotPath: SlotPath,
  vnode: VNode<Component>,
): Generator<OptionalUpdateResult, ComponentSlot, BaseInstance<Component>> {
  const instance = yield updateResult({
    type: "MOUNT",
    vnode,
    parentDom,
    slotPath,
  });
  stagingDom.appendChild(instance.startAnchor);
  stagingDom.appendChild(instance.endAnchor);
  return createComponentSlot(index, instance, slotPath);
}
