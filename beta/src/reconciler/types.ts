import type { BaseInstance } from "../instances/base-instance";
import type { Component, Context, VNode } from "yract-beta";
import type { RefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";

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
