import type { ContextSlotType } from "../slots/slot";
import {
  type ComponentSlotType,
  componentSlotType,
  contextSlotType,
  type ElementSlotType,
  elementSlotType,
  type FragmentSlotType,
  fragmentSlotType,
  type TextSlotType,
  textSlotType,
} from "../slots/slot";
import type { ComponentFiber } from "../instances/component-fiber";
import type { TagNamespace } from "../render/elements/namespaces";
import { nodeNameSpace } from "../render/elements/namespaces";
import {
  $createComponentSlot,
  $createElementSlot,
  $createFragmentSlot,
  $createTextSlot,
  $updateRef,
  isRefProps,
} from "./delegation";

import { mount } from "./reconciler";
import type { ContextMap } from "../render/types";
import type { SlotIntent } from "../slots/slot-intent";

/** Converts SlotIntent<T> to Slot<T>*/
export function mountIntent(
  intent: SlotIntent,
  parentFiber: ComponentFiber,
  ns: TagNamespace,
  parentDom: Node,
  stagingDom: Node,
  ctx: ContextMap,
) {
  switch (intent.type) {
    case contextSlotType:
    case componentSlotType:
      return mountInstanceIntent(intent, parentDom, stagingDom, ns, ctx);
    case textSlotType:
      return mountTextIntent(intent, stagingDom);
    case elementSlotType:
      return mountElementIntent(intent, stagingDom, parentFiber, ns, ctx);
    case fragmentSlotType:
      return mountFragmentIntent(intent, parentDom, stagingDom, parentFiber, ns, ctx);
    default:
      throw new Error(`yract-beta: unknown SlotIntent: ${JSON.stringify(intent satisfies never)}`);
  }
}

function* mountFragmentIntent(
  intent: SlotIntent<FragmentSlotType>,
  parentDom: Node,
  stagingDom: Node,
  parentFiber: ComponentFiber,
  ns: TagNamespace,
  ctx: ContextMap,
) {
  const { headNode, tailNode } = yield* $createFragmentSlot(intent, ns);
  const { path, children } = intent;
  stagingDom.appendChild(headNode);
  intent.slots = yield* mount(children, parentFiber, parentDom, stagingDom, path, ns, ctx);
  stagingDom.appendChild(tailNode);
}

function* mountElementIntent(
  intent: SlotIntent<ElementSlotType>,
  stagingDom: Node,
  parentFiber: ComponentFiber,
  ns: TagNamespace,
  ctx: ContextMap,
) {
  const { headNode } = yield* $createElementSlot(intent, ns);
  const { children, path, props } = intent;
  stagingDom.appendChild(headNode);
  ns = nodeNameSpace(headNode);
  intent.slots = yield* mount(children, parentFiber, headNode, headNode, path, ns, ctx);
  if (isRefProps(props)) yield $updateRef(intent);
}

function* mountInstanceIntent(
  intent: SlotIntent<ComponentSlotType | ContextSlotType>,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
  ctx: ContextMap,
) {
  const { headNode, tailNode } = yield* $createComponentSlot(intent, parentDom, ns, ctx);
  stagingDom.appendChild(headNode);
  stagingDom.appendChild(tailNode);
}

function* mountTextIntent(intent: SlotIntent<TextSlotType>, stagingDom: Node) {
  const { headNode } = yield* $createTextSlot(intent);
  stagingDom.appendChild(headNode);
}
