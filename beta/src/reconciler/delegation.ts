import type { VNodeProps } from "yract-beta";
import type { ElementPatch, RefLike } from "../render/element-props";
import { assertIsRefLike } from "../render/element-props";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";
import type { BaseInstance } from "../instances/base-instance";
import type { ComponentSlotType, ContextSlotType, Slot, SlotIntent } from "../slots/slot";

export type MountAction = {
  type: "MOUNT";
  intent: SlotIntent<ComponentSlotType | ContextSlotType>;
  parentDom: Node;
  ns: TagNamespace;
};
export type RefAction = { type: "REF"; ref: RefLike; element: SlotElement };
export type DelegationAction = MountAction | UIAction | PropsAction | RefAction;
export type PropsAction = {
  type: "PROPS";
  instance: BaseInstance;
  props: VNodeProps;
};

export type MoveAction = {
  type: "MOVE";
  parentDom: Node;
  node: undefined;
  slot: Slot;
  before: Node | null;
  text: undefined;
  patch: undefined;
};

export function deferMove(parentDom: Node, slot: Slot, before: Node | null): MoveAction {
  return {
    type: "MOVE",
    parentDom,
    node: undefined,
    slot,
    before,
    text: undefined,
    patch: undefined,
  };
}

export type InsertAction = {
  type: "INSERT";
  parentDom: Node;
  node: Node;
  slot: undefined;
  before: Node | null;
  text: undefined;
  patch: undefined;
};

export function deferInsert(parentDom: Node, node: Node, before: Node | null): InsertAction {
  return {
    type: "INSERT",
    parentDom,
    node,
    slot: undefined,
    before,
    text: undefined,
    patch: undefined,
  };
}

export type UpdateAction = {
  type: "UPDATE";
  parentDom: undefined;
  node: SlotElement;
  slot: undefined;
  before: null;
  text: undefined;
  patch: ElementPatch;
};

export function deferUpdate(node: SlotElement, patch: ElementPatch): UpdateAction {
  return {
    type: "UPDATE",
    parentDom: undefined,
    node,
    slot: undefined,
    before: null,
    text: undefined,
    patch,
  };
}

export type TextAction = {
  type: "TEXT";
  parent: undefined;
  node: Text;
  slot: undefined;
  before: null;
  text: string;
  patch: undefined;
};

export function deferText(node: Text, text: string): TextAction {
  return {
    type: "TEXT",
    parent: undefined,
    node,
    slot: undefined,
    before: null,
    text,
    patch: undefined,
  };
}

export type RemoveChange = {
  type: "REMOVE";
  parent: undefined;
  node: undefined;
  slot: Slot;
  before: null;
  text: undefined;
  patch: undefined;
};

export function deferRemove(slot: Slot): RemoveChange {
  return {
    type: "REMOVE",
    parent: undefined,
    node: undefined,
    slot,
    before: null,
    text: undefined,
    patch: undefined,
  };
}

export type UIAction = InsertAction | MoveAction | TextAction | UpdateAction | RemoveChange;

export function isRefProps<T extends VNodeProps>(props: T): props is T & { ref: RefLike } {
  if ("ref" in props) {
    const ref = props["ref"];
    assertIsRefLike(ref);
    return true;
  }
  return false;
}

export function deferRef(element: SlotElement, ref: RefLike): RefAction {
  return {
    type: "REF",
    ref,
    element,
  };
}

export function delegateMount(
  intent: SlotIntent<ComponentSlotType | ContextSlotType>,
  parentDom: Node,
  ns: TagNamespace,
): MountAction {
  return {
    type: "MOUNT",
    intent,
    parentDom,
    ns,
  };
}

export function delegateProps(instance: BaseInstance, props: VNodeProps): PropsAction {
  return {
    type: "PROPS",
    instance,
    props,
  };
}
