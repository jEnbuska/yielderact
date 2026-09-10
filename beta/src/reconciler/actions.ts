import type { ElementPatch, RefLike } from "../render/element-props";
import { assertIsRefLike } from "../render/element-props";
import type { TagNamespace } from "../render/elements/namespaces";
import type {
  ElementSlotType,
  FragmentSlotType,
  Slot,
  SlotType,
  TextSlotType,
} from "../slots/slot";
import type { Intent } from "../slots/intent";

export type CreateSlotResponse<T extends SlotType> = Pick<Slot<T>, "headNode" | "tailNode">;

type UIActionShape = {
  before: Node | null;
  node: Node | undefined;
  ns: TagNamespace | undefined;
  parentDom: Node | undefined;
  patch: undefined | ElementPatch;
  slot: Intent | undefined;
  type: string;
};
type Delegated<T extends UIActionShape> = Pick<T, keyof UIActionShape>;

export type CreateElementAction = Delegated<{
  before: null;
  node: undefined;
  ns: TagNamespace;
  parentDom: undefined;
  patch: undefined;
  slot: Intent<ElementSlotType>;
  type: "CREATE";
}>;

export type CreateFragmentAction = Delegated<{
  before: null;
  node: undefined;
  ns: TagNamespace;
  parentDom: undefined;
  patch: undefined;
  slot: Intent<FragmentSlotType>;
  type: "CREATE";
}>;

export type CreateTextAction = Delegated<{
  before: null;
  node: undefined;
  ns: undefined;
  parentDom: undefined;
  patch: undefined;
  slot: Intent<TextSlotType>;
  type: "CREATE";
}>;

export type MoveAction = Delegated<{
  before: Node | null;
  node: undefined;
  ns: undefined;
  parentDom: Node;
  patch: undefined;
  slot: Slot;
  type: "MOVE";
}>;

export type InsertAction = Delegated<{
  before: Node | null;
  node: Node;
  ns: undefined;
  parentDom: Node;
  patch: undefined;
  slot: undefined;
  type: "INSERT";
}>;

export type ElementUpdateAction = Delegated<{
  before: null;
  node: undefined;
  ns: undefined;
  parentDom: undefined;
  patch: ElementPatch;
  slot: Slot<ElementSlotType>;
  type: "UPDATE";
}>;

export type TextChangeAction = Delegated<{
  before: null;
  node: undefined;
  ns: undefined;
  parentDom: undefined;
  patch: undefined;
  slot: Slot<TextSlotType>;
  type: "TEXT";
}>;

export type RemoveSlotAction = Delegated<{
  before: null;
  node: undefined;
  ns: undefined;
  parentDom: undefined;
  patch: undefined;
  slot: Slot;
  type: "REMOVE";
}>;

export type UIAction =
  InsertAction | MoveAction | TextChangeAction | ElementUpdateAction | RemoveSlotAction;

export function isRefProps<T extends Record<string, unknown>>(
  props: T,
): props is T & { ref?: RefLike } {
  if ("ref" in props) {
    const ref = props["ref"];
    if (ref === undefined) return false;
    assertIsRefLike(ref);
    return true;
  }
  return false;
}

export function prepareCreate(slot: Intent<ElementSlotType>, ns: TagNamespace): CreateElementAction;
export function prepareCreate(
  slot: Intent<FragmentSlotType>,
  ns: TagNamespace,
): CreateFragmentAction;
export function prepareCreate(slot: Intent<TextSlotType>): CreateTextAction;
export function prepareCreate(slot: any, ns?: TagNamespace) {
  return {
    type: "CREATE",
    slot,
    before: null,
    node: undefined,
    ns,
    parentDom: undefined,
    patch: undefined,
  };
}

export function prepareText(slot: Slot<TextSlotType>): TextChangeAction {
  return {
    type: "TEXT",
    slot,
    before: null,
    node: undefined,
    ns: undefined,
    parentDom: undefined,
    patch: undefined,
  };
}

export function prepareMove(parentDom: Node, slot: Slot, before: Node | null): MoveAction {
  return {
    type: "MOVE",
    slot,
    before,
    node: undefined,
    ns: undefined,
    parentDom,
    patch: undefined,
  };
}
export function prepareInsert(parentDom: Node, node: Node, before: Node | null): InsertAction {
  return {
    type: "INSERT",
    slot: undefined,
    before,
    node,
    ns: undefined,
    parentDom,
    patch: undefined,
  };
}
export function prepareUpdate(
  slot: Slot<ElementSlotType>,
  patch: ElementPatch,
): ElementUpdateAction {
  return {
    type: "UPDATE",
    slot,
    before: null,
    node: undefined,
    ns: undefined,
    parentDom: undefined,
    patch,
  };
}

export function prepareRemove(slot: Slot): RemoveSlotAction {
  return {
    type: "REMOVE",
    slot,
    before: null,
    node: undefined,
    ns: undefined,
    parentDom: undefined,
    patch: undefined,
  };
}
