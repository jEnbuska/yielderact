import type {
  ComponentSlotType,
  FragmentSlotType,
  InstanceSlotNodes,
  SlotIntent,
} from "../slots/slot";
import {
  componentSlotType,
  type ContextSlotType,
  contextSlotType,
  type ElementSlotType,
  elementSlotType,
  fragmentSlotType,
  type TextSlotType,
  textSlotType,
} from "../slots/slot";
import type { TagNamespace } from "../render/elements/namespaces";
import { nodeNameSpace } from "../render/elements/namespaces";
import type { DelegationAction, InsertAction, MountAction } from "./delegation";
import { deferInsert, deferRef, delegateMount, isRefProps } from "./delegation";
import { toElementSlot, toFragmentSlot, toTextSlot } from "../slots/utils";
import type { BaseInstance } from "../instances/base-instance";
import { mount } from "./reconciler";

/**
 * Updated SlotIntent<T> to Slot<T>
 * */
export function buildIntentToSlot(
  intent: SlotIntent,
  parentInstance: BaseInstance,
  ns: TagNamespace,
  parentDom: Node,
  beforeNode: null | Node,
): Generator<DelegationAction, void, InstanceSlotNodes> {
  switch (intent.type) {
    case componentSlotType:
    case contextSlotType:
      return buildInstanceIntentToSlot(intent, parentDom, beforeNode, ns);
    case textSlotType:
      return buildIntentToTextSlot(intent, parentDom, beforeNode);
    case elementSlotType:
      return buildIntentToElementSlot(intent, parentDom, beforeNode, ns, parentInstance);
    case fragmentSlotType:
      return buildIntentToFragmentSlot(intent, parentDom, beforeNode, ns, parentInstance);
    default:
      throw new Error(`yract-beta: unknown intent: ${intent satisfies never}`);
  }
}

function* buildInstanceIntentToSlot<T extends ComponentSlotType | ContextSlotType>(
  intent: SlotIntent<T>,
  parentDom: Node,
  beforeNode: Node | null,
  ns: TagNamespace,
): Generator<MountAction | InsertAction, void, InstanceSlotNodes> {
  const res = yield delegateMount(intent, parentDom, ns);
  const { headNode, tailNode } = res;
  const stagingDom = document.createDocumentFragment();
  stagingDom.appendChild(headNode);
  stagingDom.appendChild(tailNode);
  yield deferInsert(parentDom, stagingDom, beforeNode);
}

function* buildIntentToElementSlot(
  intent: SlotIntent<ElementSlotType>,
  parentDom: Node,
  beforeNode: null | Node,
  ns: TagNamespace,
  parentInstance: BaseInstance,
): Generator<DelegationAction, void> {
  toElementSlot(intent, parentInstance.rctx.delegationRoot, ns);
  const { headNode, children, path } = intent;
  ns = nodeNameSpace(headNode);
  intent.slots = yield* mount(children, parentInstance, headNode, headNode, path, ns);
  const { props } = intent;
  if (isRefProps(props)) yield deferRef(headNode, props.ref);
  yield deferInsert(parentDom, headNode, beforeNode);
}

function* buildIntentToFragmentSlot(
  intent: SlotIntent<FragmentSlotType>,
  parentDom: Node,
  beforeNode: Node | null,
  ns: TagNamespace,
  parentInstance: BaseInstance,
): Generator<DelegationAction, void> {
  toFragmentSlot(intent);
  const stagingDom = document.createDocumentFragment();
  const { headNode, tailNode, children, path } = intent;
  stagingDom.appendChild(headNode);
  stagingDom.appendChild(tailNode);
  // Recursively reconcile children between the anchors.
  intent.slots = yield* mount(children, parentInstance, parentDom, stagingDom, path, ns);
  yield deferInsert(parentDom, stagingDom, beforeNode);
}

function* buildIntentToTextSlot(
  intent: SlotIntent<TextSlotType>,
  parentDom: Node,
  beforeNode: Node | null,
): Generator<InsertAction, void> {
  toTextSlot(intent);
  const { headNode } = intent;
  yield deferInsert(parentDom, headNode, beforeNode);
}
