import type { Child, Children } from "../jsx";
import type { ComponentFiber } from "../instances/component-fiber";
import type {
  ContextSlotType,
  ElementSlotType,
  FragmentSlotType,
  Slot,
  TextSlotType,
} from "../slots/slot";
import { type ComponentSlotType, extendIntentNodes, extendIntentWithInstance } from "../slots/slot";
import type { AnyElement, TagNamespace } from "../render/elements/namespaces";
import type { DelegationAction, DelegationResponse, UIAction } from "./delegation";
import { $moveSlot, $removeSlot } from "./delegation";
import { childrenToIntents, childToIntent, fillIntentDrafts, inheritSlot } from "./prepare";
import { getMapValues, getMapValuesReversed } from "../general";
import { deriveStableIndexes } from "./derive-stable-indexes";
import { buildIntentToSlot } from "./build-intent-to-slot";
import { updateSlot } from "./update-slot";
import { mountIntent } from "./mount-intent";
import type { RefLike } from "../render/element-props";
import type { ContextMap } from "../render/types";
import { PROPS_REASON } from "../render-reasons";
import type { DraftBy } from "../general-types";
import { toElementSlot, toFragmentSlot, toTextSlot } from "../slots/utils";
import type { SlotIntent } from "../slots/slot-intent";
import { emptyChildren } from "../slots/slot-intent";
import { createInstance } from "../instances/register-create";

export function* reconcile(
  children: Children[] = emptyChildren,
  parentFiber: ComponentFiber,
  parentDom: Node,
  path: string,
  oldSlots: ReadonlyMap<string, Slot>,
  ns: TagNamespace,
  beforeNode: Node | null,
  ctx: ContextMap,
): Generator<DelegationAction, ReadonlyMap<string, Slot>, DelegationResponse> {
  const drafts = childrenToIntents(children, path);
  const stableIndexes = deriveStableIndexes(drafts, oldSlots);
  fillIntentDrafts(oldSlots, drafts, stableIndexes);
  for (const slot of getMapValuesReversed(oldSlots)) {
    if (drafts.has(slot.key)) continue;
    yield $removeSlot(slot);
  }
  const slots = drafts as ReadonlyMap<string, Slot>;
  for (const slot of getMapValuesReversed(slots)) {
    if (slot.headNode === undefined) {
      // ... new SlotIntent
      yield* buildIntentToSlot(slot, parentFiber, ns, parentDom, beforeNode, ctx);
    } else {
      // ... Slot
      yield* updateSlot(slot, parentFiber, ns, ctx);
      if (slot.move) {
        yield $moveSlot(parentDom, slot, beforeNode);
      }
    }
    beforeNode = slot.headNode;
  }
  return slots;
}

export function* reconcileRoot(
  child: Child,
  parentFiber: ComponentFiber,
  parentDom: Node,
  prevSlot: Slot,
  ns: TagNamespace,
  beforeNode: Node | null,
  ctx: ContextMap,
): Generator<DelegationAction, Slot> {
  const intent = childToIntent(child ?? "");
  if (intent.key !== prevSlot.key) {
    yield $removeSlot(prevSlot);
    yield* buildIntentToSlot(intent, parentFiber, ns, parentDom, beforeNode, ctx);
    return intent as Slot;
  } else {
    inheritSlot(intent, prevSlot);
    yield* updateSlot(intent, parentFiber, ns, ctx);
    return intent;
  }
}

export function* mount(
  children: Children[],
  parentFiber: ComponentFiber,
  parentDom: Node,
  stagingDom: Node,
  parentPath: string,
  ns: TagNamespace,
  ctx: ContextMap,
): Generator<DelegationAction, ReadonlyMap<string, Slot>> {
  const slots = childrenToIntents(children, parentPath) as any as ReadonlyMap<string, Slot>;
  for (const draft of getMapValues(slots)) {
    yield* mountIntent(draft, parentFiber, ns, parentDom, stagingDom, ctx);
  }
  return slots;
}

export function* mountRoot(
  child: Child,
  parentFiber: ComponentFiber,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
  ctx: ContextMap,
): Generator<DelegationAction, Slot> {
  const intent = childToIntent(child ?? "");
  yield* mountIntent(intent, parentFiber, ns, parentDom, stagingDom, ctx);
  return intent as Slot;
}

export type ResolveComponentRender = {
  domActions: Array<UIAction> | undefined;
  unmountInstances: undefined | Set<ComponentFiber>;
  instances: undefined | Map<string, ComponentFiber>;
  refs: undefined | Map<AnyElement, RefLike>;
  slots: Slot;
  renderInstances: undefined | ComponentFiber[];
  updateInstances:
    | undefined
    | Array<Omit<DraftBy<Slot<ComponentSlotType | ContextSlotType>, "prevProps">, "type">>;
};

export function reconcileFiber(
  generator: Generator<DelegationAction, Slot, DelegationResponse>,
  fiber: ComponentFiber,
): ResolveComponentRender {
  const prevInstances = fiber.instances;
  let domActions: Array<UIAction> | undefined;
  const unmountInstances: Set<ComponentFiber> | undefined = prevInstances?.size
    ? new Set(prevInstances.values())
    : undefined;
  let renderInstances: ComponentFiber[] | undefined;
  let updateInstances:
    | Array<Omit<DraftBy<Slot<ComponentSlotType | ContextSlotType>, "prevProps">, "type">>
    | undefined;
  let instances: Map<string, ComponentFiber> | undefined = prevInstances?.size
    ? new Map()
    : undefined;
  let result = generator.next();
  let refs: undefined | Map<AnyElement, RefLike> = undefined;
  const preparedSlots = (fiber.preparedSlots ??= new Map<string, Omit<Slot, "stagingDom">>());
  const { delegationRoot } = fiber.rctx;

  function handleSetProps(
    slot: Omit<DraftBy<Slot<ComponentSlotType | ContextSlotType>, "prevProps">, "type">,
  ) {
    const { instance } = slot;
    unmountInstances?.delete(instance);
    if (instance.unmounted) {
      instance.unmounted = false;
      if (instance.renderReasons?.has(PROPS_REASON)) {
        // TODO this needs to be re-checked
        renderInstances ??= [];
        renderInstances.push(instance);
      }
    }
    updateInstances ??= [];
    updateInstances.push(slot);
  }

  while (!result.done) {
    const next = result.value;
    switch (next.type) {
      case "CREATE": {
        const { slot, ns } = next;
        const { path } = slot;
        const preparedSlot = preparedSlots.get(path);
        if (preparedSlot) {
          result = generator.next(preparedSlot);
          break;
        }
        switch (next.kind) {
          case "element":
            toElementSlot(slot as SlotIntent<ElementSlotType>, delegationRoot, ns!);
            break;
          case "text":
            toTextSlot(slot as SlotIntent<TextSlotType>);
            break;
          case "fragment":
            toFragmentSlot(slot as SlotIntent<FragmentSlotType>);
            break;
          default:
            throw new Error(`Invalid CREATE kind ${JSON.stringify(next satisfies never)}`);
        }
        preparedSlots.set(path, slot as Slot);
        result = generator.next(slot as Slot);
        break;
      }
      case "REMOVE":
      case "INSERT":
      case "MOVE":
      case "UPDATE":
      case "TEXT":
        domActions ??= [];
        domActions.push(next);
        result = generator.next();
        break;
      case "PROPS": {
        handleSetProps(next.slot);
        result = generator.next();
        break;
      }
      case "REF": {
        refs ??= new Map();
        const { headNode, props } = next.slot;
        refs!.set(headNode!, props.ref!);
        result = generator.next();
        break;
      }
      case "MOUNT": {
        const { slot, parentDom, ns, ctx } = next;
        const { path } = slot;
        const existingInstance = prevInstances?.get(path);
        let instance: ComponentFiber;
        if (existingInstance) {
          instance = existingInstance;
          instance.ctx = ctx;
          instance.parentDom = parentDom;
          extendIntentWithInstance(slot, instance);
          handleSetProps(slot);
        } else {
          extendIntentNodes(slot);
          instance = createInstance(slot, ctx, fiber, fiber.rctx, parentDom, ns);
          renderInstances ??= [];
          renderInstances.push(instance);
        }
        instances ??= new Map<string, ComponentFiber>();
        instances.set(path, instance);
        result = generator.next(slot);
        break;
      }
      default:
        throw new Error(`unknown type`);
    }
  }

  return {
    domActions,
    renderInstances,
    unmountInstances,
    updateInstances,
    instances,
    refs,
    slots: result.value,
  };
}
