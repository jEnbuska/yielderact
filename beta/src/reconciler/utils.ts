import type { DelegatedProps, DelegatedRef, DelegatedUI, MountResult } from "./types";
import type { Component, Context, VNode, VNodeProps } from "yract-beta";
import type { RefLike } from "../render/element-props";
import { assertIsRefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";
import type { BaseInstance } from "../instances/base-instance";

import type { Slot } from "../slots/slot";
import { componentSlotType, contextSlotType, fragmentSlotType } from "../slots/slot";

export function isRefProps<T extends VNodeProps>(props: T): props is T & { ref: RefLike } {
  if ("ref" in props) {
    const ref = props["ref"];
    assertIsRefLike(ref);
    return true;
  }
  return false;
}

export function $delegateRef(element: SlotElement, ref: RefLike): DelegatedRef {
  return {
    type: "REF",
    ref,
    element,
  };
}

export function $delegateUi(callback: () => unknown): DelegatedUI {
  return {
    type: "UI",
    callback,
  };
}
export function $delegateMount(
  vnode: VNode<Component | Context>,
  path: string,
  parentDom: Node,
  ns: TagNamespace,
): MountResult {
  return {
    type: "MOUNT",
    vnode,
    path,
    parentDom,
    ns,
  };
}

export function $delegateProps(instance: BaseInstance, vnode: VNode): DelegatedProps {
  return {
    type: "PROPS",
    instance,
    vnode,
  };
}

export function slotFirstNode(slot: Slot): Node {
  switch (slot.type) {
    case componentSlotType:
    case contextSlotType:
      return slot.instance.startAnchor;
    default:
      return slot.node;
  }
}

export function slotLastNode(slot: Slot): Node {
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
