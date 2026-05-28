import type { ComponentFiber } from "../instances/component-fiber";
import type { SlotIntent } from "../slots/slot-intent";
import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  FragmentSlotType,
  TextSlotType,
} from "../slots/slot";
import { extendIntentNodes, extendIntentWithInstance, type Slot } from "../slots/slot";
import type { TagNamespace } from "../render/elements/namespaces";
import type { ContextMap } from "../render/types";
import { MOUNT_REASON } from "../render-reasons";
import type {
  CreateElementAction,
  CreateFragmentAction,
  CreateSlotResponse,
  CreateTextAction,
} from "./actions";
import { prepareSlotNodes, updateWithPreparedSlot } from "../slots/utils";
import { createFiber } from "../instances/register-create";

export function handleMountSlot(
  fiber: ComponentFiber,
  intent: SlotIntent<ComponentSlotType | ContextSlotType>,
  parentDom: Node,
  ns: TagNamespace,
  ctx: ContextMap,
) {
  const { path } = intent;
  const existingInstance = fiber.instances?.get(path);
  let instance: ComponentFiber;
  if (existingInstance) {
    instance = existingInstance;
    instance.ctx = ctx;
    instance.parentDom = parentDom;
    extendIntentWithInstance(intent, instance);
    if (fiber.unmountInstances?.delete(instance)) instance.unmounted = false;
    instance.setProps(intent);
  } else {
    instance = createFiber(extendIntentNodes(intent), ctx, fiber, fiber.rctx, parentDom, ns);
    intent.instance = instance;
    instance.scheduleRender(MOUNT_REASON);
  }
  (fiber.instances ??= new Map<string, ComponentFiber>()).set(path, instance);
  return intent as Slot<ComponentSlotType>;
}

export function handleCreateNode(
  fiber: ComponentFiber,
  action: CreateElementAction,
): CreateSlotResponse<ElementSlotType>;
export function handleCreateNode(
  fiber: ComponentFiber,
  action: CreateFragmentAction,
): CreateSlotResponse<FragmentSlotType>;
export function handleCreateNode(
  fiber: ComponentFiber,
  action: CreateTextAction,
): CreateSlotResponse<TextSlotType>;
export function handleCreateNode(
  fiber: ComponentFiber,
  action: CreateElementAction | CreateFragmentAction | CreateTextAction,
): CreateSlotResponse<any> {
  const { preparedSlots, rctx } = fiber;
  const { slot, ns } = action;
  const { path } = slot;
  const prepared = preparedSlots!.get(path);
  let resultSlot: Slot<ElementSlotType | TextSlotType | FragmentSlotType>;
  if (prepared) {
    resultSlot = updateWithPreparedSlot(slot, prepared, rctx.delegationRoot);
  } else {
    resultSlot = prepareSlotNodes(slot, rctx.delegationRoot, ns);
  }
  preparedSlots!.set(path, resultSlot);
  return resultSlot;
}

export function handleUpdateSlotProps(
  fiber: ComponentFiber,
  slot: Slot<ComponentSlotType | ContextSlotType>,
) {
  const { instance, path } = slot;
  if (fiber.unmountInstances?.delete(instance)) instance.unmounted = false;
  instance.setProps(slot);
  (fiber.instances ??= new Map<string, ComponentFiber>()).set(path, instance);
}

export function handleUpdateRef(fiber: ComponentFiber, slot: SlotIntent<ElementSlotType>) {
  const { headNode, props } = slot;
  (fiber.nextRefs ??= new Map()).set(headNode!, props.ref!);
}
