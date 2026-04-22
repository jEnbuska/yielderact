import type { Slot, SlotKey, SlotPath } from "../render/slots";
import type { BaseInstance } from "../instances/base-instance";
import type { Component, Context, VNode } from "yract-beta";

export type MountResult = {
  type: "MOUNT";
  vnode: VNode<Component | Context>;
  slotPath: SlotPath;
  index: number;
  parentDom: Node;
};

export type UnmountResult = { type: "UNMOUNT"; instance: BaseInstance; slotPath: SlotPath };
export type DomResult = { type: "DOM"; callback: () => void };
export type OptionalUpdateResult = void | UpdateResult;
export type UpdateResult = MountResult | UnmountResult | DomResult | SetPropsResult;

export type SetPropsResult = {
  type: "SET_PROPS";
  instance: BaseInstance;
  vnode: VNode;
};

export interface ReconcileResult {
  slots: Slot[];
  keyIndex: Map<SlotKey, number>;
}
