import type { Component, Context, VNode, VNodeProps } from "yract-beta";
import type { RefLike } from "../render/element-props";
import { assertIsRefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";
import type { BaseInstance } from "../instances/base-instance";

export type DelegateMount = {
  type: "MOUNT";
  vnode: VNode<Component | Context>;
  path: string;
  parentDom: Node;
  ns: TagNamespace;
};
export type DelegatedUI = { type: "UI"; callback: () => void };
export type DelegatedRef = { type: "REF"; ref: RefLike; element: SlotElement };
export type DelegationAction = DelegateMount | DelegatedUI | DelegatedProps | DelegatedRef;
export type OptionalDelegationAction = void | DelegationAction;
export type DelegatedProps = {
  type: "PROPS";
  instance: BaseInstance;
  vnode: VNode;
};

export function isRefProps<T extends VNodeProps>(props: T): props is T & { ref: RefLike } {
  if ("ref" in props) {
    const ref = props["ref"];
    assertIsRefLike(ref);
    return true;
  }
  return false;
}

export function delegateRef(element: SlotElement, ref: RefLike): DelegatedRef {
  return {
    type: "REF",
    ref,
    element,
  };
}

export function delegateUi(callback: () => unknown): DelegatedUI {
  return {
    type: "UI",
    callback,
  };
}
export function delegateMount(
  vnode: VNode<Component | Context>,
  path: string,
  parentDom: Node,
  ns: TagNamespace,
): DelegateMount {
  return {
    type: "MOUNT",
    vnode,
    path,
    parentDom,
    ns,
  };
}

export function delegateProps(instance: BaseInstance, vnode: VNode): DelegatedProps {
  return {
    type: "PROPS",
    instance,
    vnode,
  };
}
