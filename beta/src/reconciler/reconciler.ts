import type { Child, Children, VNodeProps } from "../jsx";
import type { BaseInstance } from "../instances/base-instance";
import type { InstanceSlotNodes, Slot, SlotIntent } from "../slots/slot";
import { type ComponentSlotType, type ContextSlotType, intentToSlot } from "../slots/slot";
import type { SlotElement, TagNamespace } from "../render/elements/namespaces";
import type { DelegateMount, DelegateRef, DelegationAction } from "./delegation";
import { deferUi } from "./delegation";
import {
  createDraftIntent,
  delegateRemovals,
  draftIntents,
  fillIntentDrafts,
  inheritSlot,
} from "./slot-intent";
import { moveSlot } from "./dom-updates";
import { getMapValues, getMapValuesReversed, stage } from "../general";
import { deriveStableIndexes } from "./derive-stable-indexes";
import { getChildType } from "../child";
import { buildIntentToSlot } from "./build-intent-to-slot";
import { updateSlot } from "./update-slot";
import { mountIntent } from "./mount-intent";
import { removeSlotNodes } from "./dom-remove";
import type { RefLike } from "../render/element-props";
import type { ContextMap, RenderContext } from "../render/types";

export function* reconcile(
  children: Children[],
  parentInstance: BaseInstance,
  parentDom: Node,
  path: string,
  oldSlots: ReadonlyMap<string, Slot>,
  ns: TagNamespace,
  beforeNode: Node | null,
): Generator<DelegationAction, ReadonlyMap<string, Slot>, BaseInstance> {
  const drafts = draftIntents(children, path);
  const stableIndexes = deriveStableIndexes(drafts, oldSlots);
  fillIntentDrafts(oldSlots, drafts, stableIndexes);
  yield* delegateRemovals(drafts, oldSlots);
  const slots = drafts as ReadonlyMap<string, Slot>;
  for (const slot of getMapValuesReversed(slots)) {
    if (slot.headNode === undefined) {
      yield* buildIntentToSlot(slot, parentInstance, ns, parentDom, beforeNode);
    } else {
      yield* updateSlot(slot, parentInstance, ns);
      if (slot.move) {
        yield deferUi(stage(moveSlot, slot, parentDom, beforeNode));
      }
    }
    beforeNode = slot.headNode;
  }
  return slots;
}

export function* reconcileRoot(
  child: Child,
  parentInstance: BaseInstance,
  parentDom: Node,
  prevSlot: Slot,
  ns: TagNamespace,
  beforeNode: Node | null,
): Generator<DelegationAction, Slot, BaseInstance> {
  const type = getChildType(child);
  const intent = createDraftIntent(type, child, 0, "");
  if (intent.key !== prevSlot.key) {
    yield deferUi(stage(removeSlotNodes, prevSlot));
    yield* buildIntentToSlot(intent, parentInstance, ns, parentDom, beforeNode);
    return intent as Slot;
  } else {
    inheritSlot(intent, prevSlot);
    yield* updateSlot(intent, parentInstance, ns);
    return intent;
  }
}

export function* mount(
  children: Children[],
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  parentPath: string,
  ns: TagNamespace,
): Generator<DelegateMount | DelegateRef, ReadonlyMap<string, Slot>> {
  const slots = draftIntents(children, parentPath) as any as ReadonlyMap<string, Slot>;
  for (const draft of getMapValues(slots)) {
    yield* mountIntent(draft, parentInstance, ns, parentDom, stagingDom);
  }
  return slots;
}

export function* mountRoot(
  child: Child,
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
): Generator<DelegateMount | DelegateRef, Slot> {
  const type = getChildType(child);
  const draft = createDraftIntent(type, child, 0, "");
  yield* mountIntent(draft, parentInstance, ns, parentDom, stagingDom);
  return draft as Slot;
}

type CreateInstance = (
  headNode: Comment,
  tailNode: Comment,
  intent: SlotIntent<ComponentSlotType | ContextSlotType>,
  parentCtx: ContextMap,
  parent: BaseInstance | null,
  rctx: RenderContext,
  parentDom: Node,
  ns: TagNamespace,
) => BaseInstance;
export let createInstance: CreateInstance;

export function registerCreateInstance(callback: CreateInstance): void {
  createInstance = callback;
}

export type ResolveComponentRender = {
  domUpdates: Array<() => void>;
  unmountInstances: Set<BaseInstance> | undefined;
  instances: Map<string, BaseInstance> | undefined;
  refs: Map<SlotElement, RefLike> | undefined;
  slots: Slot;
  renderInstances: BaseInstance[] | undefined;
  updateInstances: Array<{ instance: BaseInstance; props: VNodeProps }> | undefined;
};
export function resolveComponentRender(
  generator: Generator<DelegationAction, Slot, InstanceSlotNodes>,
  parent: BaseInstance,
): ResolveComponentRender {
  const prevInstances = parent.instances;
  const domUpdates: Array<() => void> = [];
  const unmountInstances: Set<BaseInstance> | undefined = prevInstances?.size
    ? new Set(prevInstances.values())
    : undefined;
  let renderInstances: BaseInstance[] | undefined;
  let updateInstances: Array<{ instance: BaseInstance; props: VNodeProps }> | undefined;
  let instances: Map<string, BaseInstance> | undefined = prevInstances?.size
    ? new Map()
    : undefined;
  let result = generator.next();
  let refs: undefined | Map<SlotElement, RefLike> = undefined;

  function handleSetProps(instance: BaseInstance, props: VNodeProps) {
    unmountInstances?.delete(instance);
    if (instance.unmounted) {
      instance.unmounted = false;
      if (instance.renderReasons?.size) {
        // Ensure the instance will anyway render even though new props equals current props
        renderInstances ??= [];
        renderInstances.push(instance);
      }
    }
    updateInstances ??= [];
    updateInstances.push({ instance, props });
  }

  while (!result.done) {
    const next = result.value;
    switch (next.type) {
      case "UI":
        domUpdates.push(next.callback);
        result = generator.next();
        break;
      case "PROPS": {
        const { instance, props } = next;
        handleSetProps(instance, props);
        result = generator.next();
        break;
      }
      case "REF": {
        refs ??= new Map();
        refs!.set(next.element, next.ref);
        result = generator.next();
        break;
      }
      case "MOUNT": {
        const { intent, parentDom, ns } = next;
        const { path, child } = intent;
        const existingInstance = prevInstances?.get(path);
        let instance: BaseInstance;
        if (existingInstance) {
          handleSetProps(existingInstance, child.props);
          instance = existingInstance;
        } else {
          const { name } = intent.child.type;
          const headNode = document.createComment(`<${name}>`);
          const tailNode = document.createComment(`</${name}>`);
          instance = createInstance(
            headNode,
            tailNode,
            intent,
            parent.ctx,
            parent,
            parent.rctx,
            parentDom,
            ns,
          );
          renderInstances ??= [];
          renderInstances.push(instance);
        }
        instances ??= new Map<string, BaseInstance>();
        instances.set(path, instance);
        intentToSlot(intent, instance.headNode, instance.tailNode, instance);
        result = generator.next(intent);
        break;
      }
      default:
        throw new Error(`unknown type`);
    }
  }

  return {
    domUpdates,
    renderInstances,
    unmountInstances,
    updateInstances,
    instances,
    refs,
    slots: result.value,
  };
}
