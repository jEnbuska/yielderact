import type { ComponentSlotType, ContextSlotType, FragmentSlotType } from "../slots/slot";
import {
  componentSlotType,
  contextSlotType,
  type ElementSlotType,
  elementSlotType,
  fragmentSlotType,
  type TextSlotType,
  textSlotType,
} from "../slots/slot";
import type { TagNamespace } from "../render/elements/namespaces";
import { nodeNameSpace } from "../render/elements/namespaces";
import {
  $createComponentSlot,
  $createElementSlot,
  $createFragmentSlot,
  $createTextSlot,
  $insertNode,
  $updateRef,
  isRefProps,
} from "./delegation";
import type { ComponentFiber } from "../instances/component-fiber";
import { mount } from "./reconciler";
import type { ContextMap } from "../render/types";
import type { SlotIntent } from "../slots/slot-intent";

/**
 * Updated SlotIntent<T> to Slot<T>
 * */
export function buildIntentToSlot(
  intent: SlotIntent,
  parentFiber: ComponentFiber,
  ns: TagNamespace,
  parentDom: Node,
  beforeNode: null | Node,
  ctx: ContextMap,
) {
  switch (intent.type) {
    case componentSlotType:
    case contextSlotType:
      return buildComponentIntentToSlot(intent, parentDom, beforeNode, ns, ctx);
    case textSlotType:
      return buildIntentToTextSlot(intent, parentDom, beforeNode);
    case elementSlotType:
      return buildIntentToElementSlot(intent, parentDom, beforeNode, ns, ctx, parentFiber);
    case fragmentSlotType:
      return buildIntentToFragmentSlot(intent, parentDom, beforeNode, ns, ctx, parentFiber);
    default:
      throw new Error(`yract-beta: unknown intent: ${intent}`);
  }
}

function* buildComponentIntentToSlot(
  intent: SlotIntent<ComponentSlotType | ContextSlotType>,
  parentDom: Node,
  beforeNode: Node | null,
  ns: TagNamespace,
  ctx: ContextMap,
) {
  const { headNode, tailNode } = yield* $createComponentSlot(intent, parentDom, ns, ctx);
  const stagingDom = document.createDocumentFragment();
  stagingDom.appendChild(headNode);
  stagingDom.appendChild(tailNode);
  yield $insertNode(parentDom, stagingDom, beforeNode);
}

function* buildIntentToElementSlot(
  intent: SlotIntent<ElementSlotType>,
  parentDom: Node,
  beforeNode: null | Node,
  parentNs: TagNamespace,
  ctx: ContextMap,
  parentFiber: ComponentFiber,
) {
  const { headNode } = yield* $createElementSlot(intent, parentNs);
  const { children, path } = intent;
  const ns = nodeNameSpace(headNode);
  intent.slots = yield* mount(children, parentFiber, headNode, headNode, path, ns, ctx);
  const { props } = intent;
  if (isRefProps(props)) yield $updateRef(intent);
  yield $insertNode(parentDom, headNode, beforeNode);
}

function* buildIntentToFragmentSlot(
  intent: SlotIntent<FragmentSlotType>,
  parentDom: Node,
  beforeNode: Node | null,
  ns: TagNamespace,
  ctx: ContextMap,
  parentFiber: ComponentFiber,
) {
  const { headNode, tailNode } = yield* $createFragmentSlot(intent, ns);
  const { children, path } = intent;
  const stagingDom = document.createDocumentFragment();
  stagingDom.appendChild(headNode);
  intent.slots = yield* mount(children, parentFiber, parentDom, stagingDom, path, ns, ctx);
  stagingDom.appendChild(tailNode);

  yield $insertNode(parentDom, stagingDom, beforeNode);
}

function* buildIntentToTextSlot(
  intent: SlotIntent<TextSlotType>,
  parentDom: Node,
  beforeNode: Node | null,
) {
  const { headNode } = yield* $createTextSlot(intent);
  yield $insertNode(parentDom, headNode, beforeNode);
}
