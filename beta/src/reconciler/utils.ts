import type { DelegatedProps, MountResult, DelegatedRef, DelegatedUI } from "./types";
import type { SlotKey, SlotPath } from "../slots/general";
import type { Component, Context, VNode, VNodeProps } from "yract-beta";
import type { RefLike } from "../render/element-props";
import { assertIsRefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";
import type { BaseInstance } from "../instances/base-instance";

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
    type: "UPDATE_UI",
    callback,
  };
}
export function $delegateMount(
  vnode: VNode<Component | Context>,
  slotPath: SlotPath,
  parentDom: Node,
  ns: TagNamespace,
): MountResult {
  return {
    type: "MOUNT",
    vnode,
    slotPath,
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
/**
 * Build a unique slot path string from a parent path and a child key.
 * Positional indices (number) are prefixed with `#`.
 * User-provided string keys are length-prefixed with `$` to avoid
 * collisions with indices and to handle arbitrary string content safely.
 */
export function createSlotPath(parentPath: SlotPath, key: SlotKey): SlotPath {
  if (typeof key === "number") return `${parentPath}#${key}`;
  return `${parentPath}$${key.length}:${key}`;
}
export const emptyProps: VNodeProps = {};
