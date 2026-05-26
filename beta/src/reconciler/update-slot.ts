import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  Slot,
  SlotType,
  TextSlotType,
} from "../slots/slot";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  type FragmentSlotType,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";
import type { ComponentFiber } from "../instances/component-fiber";
import type { TagNamespace } from "../render/elements/namespaces";
import { nodeNameSpace } from "../render/elements/namespaces";
import {
  $setProps,
  $updateElement,
  $updateRef,
  $updateText,
  type DelegationAction,
  DelegationResponse,
  isRefProps,
} from "./delegation";
import { diffElementProps } from "../render/element-props";
import { reconcile } from "./reconciler";
import type { ContextMap } from "../render/types";

export function* updateSlot<T extends SlotType>(
  slot: Slot<T>,
  parentFiber: ComponentFiber,
  ns: TagNamespace,
  ctx: ContextMap,
): Generator<DelegationAction, void, DelegationResponse> {
  switch (slot.type) {
    case contextSlotType:
    case componentSlotType:
      return yield* updateFiber(slot);
    case textSlotType:
      return yield* updateText(slot);
    case elementSlotType:
      return yield* updateElement(slot, parentFiber, ctx);
    case fragmentSlotType:
      return yield* updateFragment(slot, parentFiber, ctx, ns);
    default:
      throw new Error(`Unhandled update slot ${slot satisfies never}`);
  }
}

function* updateFragment(
  slot: Slot<FragmentSlotType>,
  parentFiber: ComponentFiber,
  ctx: ContextMap,
  ns: TagNamespace,
): Generator<DelegationAction, void, DelegationResponse> {
  const { tailNode, children, path, slots } = slot;
  const parentDom = tailNode.parentNode;
  if (!parentDom) {
    throw new Error("yract-beta: fragment slot reconciled with detached start anchor");
  }
  slot.slots = yield* reconcile(children, parentFiber, parentDom, path, slots, ns, tailNode, ctx);
}

function* updateElement(
  slot: Slot<ElementSlotType>,
  parentFiber: ComponentFiber,
  ctx: ContextMap,
): Generator<DelegationAction, void, DelegationResponse> {
  const { headNode, children, path, slots, prevProps, props } = slot;
  const ns = nodeNameSpace(headNode);
  slot.slots = yield* reconcile(children, parentFiber, headNode, path, slots, ns, null, ctx);
  const patch = diffElementProps(prevProps, props);
  if (isRefProps(slot.props)) yield $updateRef(slot);
  if (patch) yield $updateElement(slot, patch);
}

function* updateText(slot: Slot<TextSlotType>) {
  const { text } = slot;
  if (text === slot.prevText) return;
  yield $updateText(slot);
}

function* updateFiber(slot: Slot<ComponentSlotType | ContextSlotType>) {
  yield $setProps(slot);
}
