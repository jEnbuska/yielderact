import type { ElementPatch, RefLike } from "../render/element-props";
import { assertIsRefLike } from "../render/element-props";
import type { TagNamespace } from "../render/elements/namespaces";
import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  FragmentSlotType,
  Slot,
  SlotNodes,
  TextSlotType,
} from "../slots/slot";
import type { ContextMap } from "../render/types";
import type { SlotIntent } from "../slots/slot-intent";

export type DelegationResponse = Pick<Slot, "headNode" | "tailNode">;

type DelegatedShape = {
  before: Node | null;
  ctx: ContextMap | undefined;
  kind: string | undefined;
  node: Node | undefined;
  ns: TagNamespace | undefined;
  parentDom: Node | undefined;
  patch: undefined | ElementPatch;
  slot: SlotIntent | undefined;
  type: string;
};
type Delegated<T extends DelegatedShape> = Pick<T, keyof DelegatedShape>;

export type MountAction = Delegated<{
  before: null;
  ctx: ContextMap;
  kind: undefined;
  node: undefined;
  ns: TagNamespace;
  parentDom: Node;
  patch: undefined;
  slot: SlotIntent<ComponentSlotType | ContextSlotType>;
  type: "MOUNT";
}>;

export type CreateElementAction = Delegated<{
  before: null;
  ctx: undefined;
  kind: "element";
  node: undefined;
  ns: TagNamespace;
  parentDom: undefined;
  patch: undefined;
  slot: SlotIntent<ElementSlotType>;
  type: "CREATE";
}>;

export type CreateFragmentAction = Delegated<{
  before: null;
  ctx: undefined;
  kind: "fragment";
  node: undefined;
  ns: TagNamespace;
  parentDom: undefined;
  patch: undefined;
  slot: SlotIntent<FragmentSlotType>;
  type: "CREATE";
}>;

export type CreateTextAction = Delegated<{
  before: null;
  ctx: undefined;
  kind: "text";
  node: undefined;
  ns: undefined;
  parentDom: undefined;
  patch: undefined;
  slot: SlotIntent<TextSlotType>;
  type: "CREATE";
}>;

export type RefAction = Delegated<{
  before: null;
  ctx: undefined;
  kind: undefined;
  node: undefined;
  ns: undefined;
  parentDom: undefined;
  patch: undefined;
  slot: SlotIntent<ElementSlotType>;
  type: "REF";
}>;

export type DelegationAction =
  | MountAction
  | UIAction
  | PropsAction
  | RefAction
  | CreateElementAction
  | CreateTextAction
  | CreateFragmentAction;

export type PropsAction = Delegated<{
  type: "PROPS";
  slot: Slot<ComponentSlotType | ContextSlotType>;
  kind: undefined;
  parentDom: undefined;
  ctx: undefined;
  ns: undefined;
  before: null;
  patch: undefined;
  node: undefined;
}>;

export type MoveAction = Delegated<{
  type: "MOVE";
  parentDom: Node;
  kind: undefined;
  slot: Slot;
  before: Node | null;
  patch: undefined;
  ctx: undefined;
  ns: undefined;
  node: undefined;
}>;

export function $moveSlot(parentDom: Node, slot: Slot, before: Node | null): MoveAction {
  return {
    before,
    ctx: undefined,
    kind: undefined,
    node: undefined,
    ns: undefined,
    parentDom,
    patch: undefined,
    slot,
    type: "MOVE",
  };
}

export type InsertAction = Delegated<{
  type: "INSERT";
  parentDom: Node;
  node: Node;
  slot: undefined;
  before: Node | null;
  patch: undefined;
  ctx: undefined;
  kind: undefined;
  ns: undefined;
}>;

export function $insertNode(parentDom: Node, node: Node, before: Node | null): InsertAction {
  return {
    before,
    ctx: undefined,
    kind: undefined,
    node,
    ns: undefined,
    parentDom,
    patch: undefined,
    slot: undefined,
    type: "INSERT",
  };
}

export type UpdateAction = Delegated<{
  type: "UPDATE";
  parentDom: undefined;
  node: undefined;
  slot: Slot<ElementSlotType>;
  before: null;
  patch: ElementPatch;
  ctx: undefined;
  kind: undefined;
  ns: undefined;
}>;

export function $updateElement(slot: Slot<ElementSlotType>, patch: ElementPatch): UpdateAction {
  return {
    before: null,
    ctx: undefined,
    kind: undefined,
    node: undefined,
    ns: undefined,
    parentDom: undefined,
    patch,
    slot,
    type: "UPDATE",
  };
}

export type TextChange = Delegated<{
  type: "TEXT";
  node: undefined;
  slot: Slot<TextSlotType>;
  before: null;
  patch: undefined;
  parentDom: undefined;
  ctx: undefined;
  kind: undefined;
  ns: undefined;
}>;

export function $updateText(slot: Slot<TextSlotType>): TextChange {
  return {
    before: null,
    ctx: undefined,
    kind: undefined,
    ns: undefined,
    parentDom: undefined,
    patch: undefined,
    node: undefined,
    slot,
    type: "TEXT",
  };
}

export type RemoveChange = Delegated<{
  type: "REMOVE";
  node: undefined;
  slot: Slot;
  before: null;
  patch: undefined;
  parentDom: undefined;
  ctx: undefined;
  kind: undefined;
  ns: undefined;
}>;

export function $removeSlot(slot: Slot): RemoveChange {
  return {
    before: null,
    ctx: undefined,
    kind: undefined,
    node: undefined,
    ns: undefined,
    parentDom: undefined,
    patch: undefined,
    slot,
    type: "REMOVE",
  };
}

export type UIAction = InsertAction | MoveAction | TextChange | UpdateAction | RemoveChange;

export function isRefProps<T extends Record<string, unknown>>(
  props: T,
): props is T & { ref: RefLike } {
  if ("ref" in props) {
    const ref = props["ref"];
    assertIsRefLike(ref);
    return true;
  }
  return false;
}

export function $updateRef(slot: SlotIntent<ElementSlotType>): RefAction {
  return {
    before: null,
    ctx: undefined,
    kind: undefined,
    node: undefined,
    ns: undefined,
    parentDom: undefined,
    patch: undefined,
    slot,
    type: "REF",
  };
}

export function* $createComponentSlot(
  slot: SlotIntent<ComponentSlotType | ContextSlotType>,
  parentDom: Node,
  ns: TagNamespace,
  ctx: ContextMap,
): Generator<
  MountAction,
  SlotNodes<ComponentSlotType | ContextSlotType>,
  SlotNodes<ComponentSlotType | ContextSlotType>
> {
  return yield {
    before: null,
    ctx,
    kind: undefined,
    node: undefined,
    ns,
    parentDom,
    patch: undefined,
    slot,
    type: "MOUNT",
  };
}

export function $setProps(slot: Slot<ComponentSlotType | ContextSlotType>): PropsAction {
  return {
    before: null,
    ctx: undefined,
    kind: undefined,
    node: undefined,
    ns: undefined,
    parentDom: undefined,
    patch: undefined,
    slot: slot,
    type: "PROPS",
  };
}

export function* $createElementSlot(
  slot: SlotIntent<ElementSlotType>,
  ns: TagNamespace,
): Generator<CreateElementAction, SlotNodes<ElementSlotType>, SlotNodes<ElementSlotType>> {
  return yield {
    before: null,
    ctx: undefined,
    kind: "element",
    node: undefined,
    ns,
    parentDom: undefined,
    patch: undefined,
    slot,
    type: "CREATE",
  };
}

export function* $createFragmentSlot(
  slot: SlotIntent<FragmentSlotType>,
  ns: TagNamespace,
): Generator<CreateFragmentAction, SlotNodes<FragmentSlotType>, SlotNodes<FragmentSlotType>> {
  return yield {
    before: null,
    ctx: undefined,
    kind: "fragment",
    node: undefined,
    ns,
    parentDom: undefined,
    patch: undefined,
    slot,
    type: "CREATE",
  };
}

export function* $createTextSlot(
  slot: SlotIntent<TextSlotType>,
): Generator<CreateTextAction, SlotNodes<TextSlotType>, SlotNodes<TextSlotType>> {
  return yield {
    before: null,
    ctx: undefined,
    kind: "text",
    node: undefined,
    ns: undefined,
    parentDom: undefined,
    patch: undefined,
    slot,
    type: "CREATE",
  };
}
