import type { Child, Component, SingleChild } from "../jsx";
import type { BaseInstance } from "../instances/base-instance";
import { delegateMount, delegateRef, isRefProps } from "./utils";
import type { OptionalDelegationAction } from "./types";
import type { Context } from "yract-beta";
import type {
  ComponentSlot,
  ComponentSlotType,
  ContextSlot,
  ContextSlotType,
  DraftSlotIntent,
  ElementSlot,
  ElementSlotType,
  FragmentSlot,
  FragmentSlotType,
  Slot,
  SlotType,
  TextSlotType,
} from "../slots/slot";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";
import {
  createComponentSlot,
  createContextSlot,
  createElementSlot,
  createFragmentSlot,
  createSlotPath,
  createTextSlot,
} from "../slots/utils";
import type { TagNamespace } from "../render/elements/namespaces";
import { nodeNameSpace } from "../render/elements/namespaces";
import { createDraftIntent, draftIntents } from "./prepare";
import { getChildKey, getChildType } from "../child";

export function* mount(
  children: Child[],
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  parentPath: string,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, Map<string, Slot>> {
  const drafts = draftIntents(children);
  for (const [key, draft] of drafts) {
    const path = createSlotPath(parentPath, key);
    const slot = yield* mountSlot(
      draft as DraftSlotIntent,
      path,
      parentInstance,
      parentDom,
      stagingDom,
      ns,
    );
    drafts.set(key, slot);
  }
  return drafts as Map<string, Slot>;
}

export function* mountRoot(
  child: SingleChild,
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, { slot: Slot; key: string }> {
  const type = getChildType(child);
  const key = getChildKey(child, 0, type);
  const draft = createDraftIntent(type, child, key, 0);
  const slot = yield* mountSlot(draft, key, parentInstance, parentDom, stagingDom, ns);
  return { key, slot };
}

function* mountSlot<T extends SlotType>(
  intent: DraftSlotIntent<T>,
  path: string,
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, Slot> {
  switch (intent.type) {
    case componentSlotType: {
      const d = intent as DraftSlotIntent<ComponentSlotType>;
      return yield* mountComponentSlot(d, parentDom, stagingDom, path, ns);
    }
    case textSlotType: {
      const d = intent as DraftSlotIntent<TextSlotType>;
      return mountTextSlot(d, stagingDom, path);
    }
    case elementSlotType: {
      const d = intent as DraftSlotIntent<ElementSlotType>;
      return yield* mountElementSlot(d, stagingDom, path, parentInstance, ns);
    }
    case fragmentSlotType: {
      const d = intent as DraftSlotIntent<FragmentSlotType>;
      return yield* mountFragmentSlot(d, parentDom, stagingDom, path, parentInstance, ns);
    }
    case contextSlotType: {
      const d = intent as DraftSlotIntent<ContextSlotType>;
      return yield* mountContextSlot(d, parentDom, stagingDom, path, ns);
    }
    default:
      throw new Error(`yract-beta: unknown SlotType: ${intent.type satisfies never}`);
  }
}

function mountTextSlot(intent: DraftSlotIntent<TextSlotType>, stagingDom: Node, path: string) {
  const slot = createTextSlot(intent, path);
  stagingDom.appendChild(slot.node);
  return slot;
}

function* mountFragmentSlot(
  intent: DraftSlotIntent<FragmentSlotType>,
  parentDom: Node,
  stagingDom: Node,
  path: string,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, FragmentSlot> {
  const slot = createFragmentSlot(intent, path);
  stagingDom.appendChild(slot.node);
  // Children stage alongside the fragment's anchors but their `instance.parentDom`
  // tracks the real outer parent — when the staging fragment commits, the children's
  // anchors land as siblings inside the real parent.
  const slots = yield* mount(intent.children, parentInstance, parentDom, stagingDom, path, ns);
  stagingDom.appendChild(slot.endAnchor);
  slot.slots = slots;
  return slot;
}

function* mountElementSlot(
  intent: DraftSlotIntent<ElementSlotType>,
  stagingDom: Node,
  path: string,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, ElementSlot> {
  const slot = createElementSlot(intent, parentInstance.rctx.delegationRoot, path, ns);
  stagingDom.appendChild(slot.node);
  // Element children live inside the element — both logical parent and staging
  // target collapse to `slot.node` for the recursion.
  const slots = yield* mount(
    intent.children,
    parentInstance,
    slot.node,
    slot.node,
    path,
    nodeNameSpace(slot.node),
  );
  if (isRefProps(intent.props)) yield delegateRef(slot.node, intent.props.ref);
  slot.slots = slots;
  return slot;
}

function* mountContextSlot(
  intent: DraftSlotIntent<ContextSlotType>,
  parentDom: Node,
  stagingDom: Node,
  path: string,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, ContextSlot, BaseInstance<Context>> {
  const instance = yield delegateMount(intent.child, path, parentDom, ns);
  stagingDom.appendChild(instance.startAnchor);
  stagingDom.appendChild(instance.endAnchor);
  return createContextSlot(intent, instance, path);
}

function* mountComponentSlot(
  intent: DraftSlotIntent<ComponentSlotType>,
  parentDom: Node,
  stagingDom: Node,
  path: string,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, ComponentSlot, BaseInstance<Component>> {
  const instance = yield delegateMount(intent.child, path, parentDom, ns);

  stagingDom.appendChild(instance.startAnchor);
  stagingDom.appendChild(instance.endAnchor);

  return createComponentSlot(intent, instance, path);
}
