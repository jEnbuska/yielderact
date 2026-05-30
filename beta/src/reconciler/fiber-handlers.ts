import type { ComponentFiber } from "../instances/component-fiber";
import type { Intent } from "../slots/intent";
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
  intent: Intent<ComponentSlotType | ContextSlotType>,
  parentDom: Node,
  ns: TagNamespace,
  ctx: ContextMap,
) {
  const { path } = intent;
  let instance = fiber.instances?.get(path) ?? fiber.unmountInstances?.get(path);
  if (instance) {
    instance.ctx = ctx;
    instance.parentDom = parentDom;
    extendIntentWithInstance(intent, instance);
    fiber.unmountInstances?.delete(path);
    if (instance.unmounted) {
      instance.unmounted = false;
    }
    instance.setProps(intent);
  } else {
    instance = createFiber(extendIntentNodes(intent), ctx, fiber, fiber.rctx, parentDom, ns);
    intent.instance = instance;
    instance.scheduleRender(MOUNT_REASON);
  }
  (fiber.nextInstances ??= new Map<string, ComponentFiber>()).set(path, instance);
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
  // preparedSlots!.set(path, resultSlot);
  return resultSlot;
}

export function handleUpdateSlotProps(
  fiber: ComponentFiber,
  slot: Slot<ComponentSlotType | ContextSlotType>,
) {
  const { instance, path } = slot;
  fiber.unmountInstances?.delete(path);
  instance.unmounted = false;

  instance.setProps(slot);
  (fiber.nextInstances ??= new Map<string, ComponentFiber>()).set(path, instance);
}

export function handleUpdateRef(fiber: ComponentFiber, slot: Intent<ElementSlotType>) {
  const { headNode, props } = slot;
  (fiber.nextRefs ??= new Map()).set(headNode!, props.ref!);
}
