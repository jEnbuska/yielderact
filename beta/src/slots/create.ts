import type { Component, Context, VNode, VNodeProps } from "yract-beta";
import type { DelegationRoot } from "../render/delegation";
import { applyElementProps } from "../render/element-props";
import type { BaseInstance } from "../instances/base-instance";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  emptySlotType,
  fragmentSlotType,
  textSlotType,
} from "./type";
import type {
  ComponentSlot,
  ContextSlot,
  ElementSlot,
  EmptySlot,
  FragmentSlot,
  TextSlot,
} from "./slot";
import type { SlotKey, SlotPath } from "./general";

export function createEmptySlot(index: number, slotPath: SlotPath): EmptySlot {
  const node = document.createTextNode("");
  return { type: emptySlotType, node, index, slotPath };
}

export function createTextSlot(index: number, text: string | number, slotPath: SlotPath): TextSlot {
  const props = String(text);
  const node = document.createTextNode(props);
  return { type: textSlotType, node, props, index, slotPath };
}

export function createElementSlot(
  index: number,
  vnode: VNode<string>,
  delegationRoot: DelegationRoot,
  slotPath: SlotPath,
): ElementSlot {
  const { props, type } = vnode;
  const el = document.createElement(type);
  applyElementProps(el, props, delegationRoot);
  const key: SlotKey = props.key ?? index;
  return {
    type: elementSlotType,
    node: el,
    props,
    slots: [],
    key,
    index,
    element: type,
    slotPath,
  };
}

export function createFragmentSlot(
  index: number,
  props: VNodeProps,
  slotPath: SlotPath,
): FragmentSlot {
  // Fragments use a start/end comment pair so the reconciler can relocate
  // them as a unit. DocumentFragment isn't appropriate here because it
  // becomes empty as soon as it's appended to its parent.
  const node = document.createComment("fragment");
  const endAnchor = document.createComment("/fragment");
  const key: SlotKey = props.key ?? index;
  return {
    type: fragmentSlotType,
    node,
    endAnchor,
    props,
    index,
    key,
    slots: [],
    slotPath,
  };
}

export function createComponentSlot(
  index: number,
  instance: BaseInstance<Component>,
  slotPath: SlotPath,
): ComponentSlot {
  const { startAnchor, vnode } = instance;
  return {
    type: componentSlotType,
    instance,
    node: startAnchor,
    props: vnode.props,
    slots: [],
    key: vnode.props.key ?? index,
    index,
    slotPath,
  };
}

export function createContextSlot(
  index: number,
  instance: BaseInstance<Context>,
  slotPath: SlotPath,
): ContextSlot {
  const { startAnchor, vnode } = instance;
  return {
    type: contextSlotType,
    instance,
    node: startAnchor,
    props: vnode.props,
    slots: [],
    key: vnode.props.key ?? index,
    index,
    slotPath,
  };
}
