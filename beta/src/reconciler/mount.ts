import type { Child, Component, IterableChildren, VNode, VNodeProps } from "../jsx";
import type { BaseInstance } from "../instances/base-instance";
import { getIterable } from "../iterable";
import {
  getChildKey,
  isComponentChild,
  isContextChild,
  isElementVNode,
  isEmptyChild,
  isFragmentVNode,
  isIterableChild,
  isTextChild,
} from "../child";
import { createSlotPath, emptyProps, isRefProps, registerRef, updateResult } from "./utils";
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
import type { ComponentSlot, ContextSlot, ElementSlot, FragmentSlot, Slot } from "../slots/slot";
import { getSlotKey } from "../slots/utils";
import type { SlotKey, SlotPath } from "../slots/general";
import type { TagNamespace } from "../render/elements/namespaces";

export function* mount(
  children: IterableChildren,
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  parentPath: SlotPath,
  ns: TagNamespace,
) {
  const slots: Slot[] = [];
  const keyIndex = new Map<SlotKey, number>();

  let i = 0;
  for (const child of getIterable(children)) {
    const idx = i++;
    const slotPath: SlotPath = createSlotPath(parentPath, getChildKey(child, idx));
    const slot = yield* mountSlot(child, idx, slotPath, parentInstance, parentDom, stagingDom, ns);
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
  ns: TagNamespace,
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
      ns,
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
      ns,
    );
  }
  if (isElementVNode(child)) {
    return yield* mountElementSlot(stagingDom, index, slotPath, child, parentInstance, ns);
  }
  if (isContextChild(child)) {
    return yield* mountContextSlot(parentDom, stagingDom, index, slotPath, child, ns);
  }
  if (isComponentChild(child)) {
    return yield* mountComponentSlot(parentDom, stagingDom, index, slotPath, child, ns);
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
  ns: TagNamespace,
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
    ns,
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
  ns: TagNamespace,
): Generator<OptionalUpdateResult, ElementSlot> {
  const slot = createElementSlot(index, child, parentInstance.rctx.delegationRoot, slotPath, ns);
  stagingDom.appendChild(slot.node);
  // Element children live inside the element — both logical parent and staging
  // target collapse to `slot.node` for the recursion.
  const { keyIndex, slots } = yield* mount(
    child.children,
    parentInstance,
    slot.node,
    slot.node,
    slotPath,
    slot.ns,
  );
  if (isRefProps(child.props)) yield registerRef(slot.node, child.props.ref);
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
  ns: TagNamespace,
): Generator<OptionalUpdateResult, ContextSlot, BaseInstance<Context>> {
  const instance = yield updateResult({
    type: "MOUNT",
    vnode,
    parentDom,
    slotPath,
    ns,
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
  ns: TagNamespace,
): Generator<OptionalUpdateResult, ComponentSlot, BaseInstance<Component>> {
  const instance = yield updateResult({
    type: "MOUNT",
    vnode,
    parentDom,
    slotPath,
    ns,
  });
  stagingDom.appendChild(instance.startAnchor);
  stagingDom.appendChild(instance.endAnchor);
  return createComponentSlot(index, instance, slotPath);
}
