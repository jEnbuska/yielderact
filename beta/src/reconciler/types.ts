import type { BaseInstance } from "../instances/base-instance";
import type { Child, Component, Context, VNode } from "yract-beta";
import type { Slot, SlotChild, SlotType } from "../slots/slot";
import type { RefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";

export type MountResult = {
  type: "MOUNT";
  vnode: VNode<Component | Context>;
  path: string;
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
  keyIndex: Map<string, number>;
}

export type SlotIntent<T extends SlotType = SlotType> = CreateSlotIntent<T> | RenderSlotIntent<T>;

type GenericSlotIntent<A extends string, T extends SlotType, S> = {
  action: A;
  type: T;
  child: SlotChild<T>;
  text: undefined | string;
  children: Child[];
  key: string;
  index: number;
  move: boolean;
  prev: S;
};

export type CreateSlotIntent<T extends SlotType = SlotType> = GenericSlotIntent<
  "CREATED",
  T,
  undefined
>;
export type RenderSlotIntent<T extends SlotType = SlotType> = GenericSlotIntent<
  "RENDERED",
  T,
  Slot<T>
>;
