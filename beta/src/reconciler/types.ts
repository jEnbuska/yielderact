import type { Slot, SlotKey, SlotPath } from "../render/slots";
import type { BaseInstance } from "../instances/base-instance";
import type { Component, Context, VNode } from "yract-beta";

export type MountResult = {
  type: "MOUNT";
  vnode: VNode<Component | Context>;
  slotPath: SlotPath;
  parentDom: Node;
};

export type DomResult = { type: "UPDATE_UI"; callback: () => void };
export type OptionalUpdateResult = void | UpdateResult;
export type UpdateResult = MountResult | DomResult | SetPropsResult;

export type SetPropsResult = {
  type: "ENSURE_PROPS";
  instance: BaseInstance;
  vnode: VNode;
};

export interface ReconcileResult {
  slots: Slot[];
  keyIndex: Map<SlotKey, number>;
}
