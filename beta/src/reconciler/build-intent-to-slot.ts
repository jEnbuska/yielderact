import type { ComponentSlotType, FragmentSlotType, SlotIntent } from "../slots/slot";
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
import type { DelegationAction, OptionalDelegationAction } from "./types";
import type { ComponentInstance } from "../instances/component-instance";
import { delegateMount, delegateRef, delegateUi, isRefProps } from "./delegation";
import {
  toComponentSlot,
  toContextSlot,
  toElementSlot,
  toFragmentSlot,
  toTextSlot,
} from "../slots/utils";
import { stage } from "../general";
import { insertBefore } from "./dom-updates";
import type { BaseInstance } from "../instances/base-instance";
import type { ContextInstance } from "../instances/context-instance";
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
): Generator<OptionalDelegationAction, void> {
  switch (intent.type) {
    case componentSlotType:
      return buildIntentToComponentSlot(intent, parentDom, beforeNode, ns);
    case textSlotType:
      return buildIntentToTextSlot(intent, parentDom, beforeNode);
    case elementSlotType:
      return buildIntentToElementSlot(intent, parentDom, beforeNode, ns, parentInstance);
    case fragmentSlotType:
      return buildIntentToFragmentSlot(intent, parentDom, beforeNode, ns, parentInstance);
    case contextSlotType:
      return buildIntentToContextSlot(intent, parentDom, beforeNode, ns);
    default:
      throw new Error(`yract-beta: unknown intent: ${intent satisfies never}`);
  }
}

function* buildIntentToComponentSlot(
  intent: SlotIntent<ComponentSlotType>,
  parentDom: Node,
  beforeNode: Node | null,
  ns: TagNamespace,
): Generator<DelegationAction, void, ComponentInstance> {
  const { child, path } = intent;
  const instance = yield delegateMount(child, path, parentDom, ns);
  toComponentSlot(intent, instance);
  const stagingDom = document.createDocumentFragment();
  const { headNode, tailNode } = intent;
  stagingDom.appendChild(headNode);
  stagingDom.appendChild(tailNode);
  yield delegateUi(stage(insertBefore, parentDom, stagingDom, beforeNode));
}

function* buildIntentToContextSlot(
  intent: SlotIntent<ContextSlotType>,
  parentDom: Node,
  beforeNode: Node | null,
  ns: TagNamespace,
): Generator<DelegationAction, void, ContextInstance> {
  const { child, path } = intent;
  const instance = yield delegateMount(child, path, parentDom, ns);
  toContextSlot(intent, instance);
  const stagingDom = document.createDocumentFragment();
  const { headNode, tailNode } = intent;
  stagingDom.appendChild(headNode);
  stagingDom.appendChild(tailNode);
  yield delegateUi(stage(insertBefore, parentDom, stagingDom, beforeNode));
}

function* buildIntentToElementSlot(
  intent: SlotIntent<ElementSlotType>,
  parentDom: Node,
  beforeNode: null | Node,
  ns: TagNamespace,
  parentInstance: BaseInstance,
): Generator<OptionalDelegationAction, void> {
  toElementSlot(intent, parentInstance.rctx.delegationRoot, ns);
  const { headNode, children, path } = intent;
  ns = nodeNameSpace(headNode);
  intent.slots = yield* mount(children, parentInstance, headNode, headNode, path, ns);
  const { props } = intent;
  if (isRefProps(props)) yield delegateRef(headNode, props.ref);
  yield delegateUi(stage(insertBefore, parentDom, headNode, beforeNode));
}

function* buildIntentToFragmentSlot(
  intent: SlotIntent<FragmentSlotType>,
  parentDom: Node,
  beforeNode: Node | null,
  ns: TagNamespace,
  parentInstance: BaseInstance,
): Generator<OptionalDelegationAction, void> {
  toFragmentSlot(intent);
  const stagingDom = document.createDocumentFragment();
  const { headNode, tailNode, children, path } = intent;
  stagingDom.appendChild(headNode);
  stagingDom.appendChild(tailNode);
  // Recursively reconcile children between the anchors.
  intent.slots = yield* mount(children, parentInstance, parentDom, stagingDom, path, ns);
  yield delegateUi(stage(insertBefore, parentDom, stagingDom, beforeNode));
}

function* buildIntentToTextSlot(
  intent: SlotIntent<TextSlotType>,
  parentDom: Node,
  beforeNode: Node | null,
): Generator<OptionalDelegationAction, void> {
  toTextSlot(intent);
  const { headNode } = intent;
  return yield delegateUi(stage(insertBefore, parentDom, headNode, beforeNode));
}
