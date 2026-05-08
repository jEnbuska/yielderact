import type { BaseInstance } from "../instances/base-instance";
import type { Component, Context, VNode } from "yract-beta";
import type { Slot } from "../slots/slot";
import type { SlotKey, SlotPath } from "../slots/general";
import type { RefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";

export type MountResult = {
  type: "MOUNT";
  vnode: VNode<Component | Context>;
  slotPath: SlotPath;
  parentDom: Node;
  ns: TagNamespace;
};

export type DelegatedUI = { type: "UI"; callback: () => void };
export type DelegatedRef = { type: "REF"; ref: RefLike; element: SlotElement };
export type DelegationAction = MountResult | DelegatedUI | DelegatedProps | DelegatedRef;
export type OptionalDelegationAction = void | DelegationAction;

export type DelegatedProps = {
  type: "PROPS";
  instance: BaseInstance;
  vnode: VNode;
};

export interface ReconcileResult {
  slots: Slot[];
  keyIndex: Map<SlotKey, number>;
}
