import type { Child, Component } from "../jsx";
import type { BaseInstance } from "../instances/base-instance";
import { $delegateMount, $delegateRef, isRefProps } from "./utils";
import type { OptionalDelegationAction } from "./types";
import type { Context } from "yract-beta";
import type {
  ComponentSlot,
  ComponentSlotType,
  ContextSlot,
  ContextSlotType,
  ElementSlot,
  ElementSlotType,
  EmptySlotType,
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
  emptySlotType,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";
import {
  createComponentSlot,
  createContextSlot,
  createElementSlot,
  createEmptySlot,
  createFragmentSlot,
  createSlotPath,
  createTextSlot,
} from "../slots/utils";
import type { TagNamespace } from "../render/elements/namespaces";
import type { DraftIntent } from "./prepare";
import { draftIntents } from "./prepare";

export function* mount(
  children: Child[],
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  parentPath: string,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, { keyIndex: Map<string, number>; slots: Slot[] }> {
  const { drafts, keyIndex } = draftIntents(children);
  const slots: Slot[] = [];

  for (let index = 0; index < drafts.length; index++) {
    const draft = drafts[index]!;
    const path = createSlotPath(parentPath, draft.key);
    slots.push(yield* mountSlot(draft, path, parentInstance, parentDom, stagingDom, ns));
  }
  return { slots, keyIndex };
}

function* mountSlot<T extends SlotType>(
  intent: DraftIntent<T>,
  path: string,
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, Slot> {
  switch (intent.type) {
    case componentSlotType: {
      const d = intent as DraftIntent<ComponentSlotType>;
      return yield* mountComponentSlot(d, parentDom, stagingDom, path, ns);
    }
    case textSlotType: {
      const d = intent as DraftIntent<TextSlotType>;
      return mountTextSlot(d, stagingDom, path);
    }
    case elementSlotType: {
      const d = intent as DraftIntent<ElementSlotType>;
      return yield* mountElementSlot(d, stagingDom, path, parentInstance, ns);
    }
    case emptySlotType: {
      const d = intent as DraftIntent<EmptySlotType>;
      return mountEmptySlot(d, stagingDom, path);
    }
    case fragmentSlotType: {
      const d = intent as DraftIntent<FragmentSlotType>;
      return yield* mountFragmentSlot(d, parentDom, stagingDom, path, parentInstance, ns);
    }
    case contextSlotType: {
      const d = intent as DraftIntent<ContextSlotType>;
      return yield* mountContextSlot(d, parentDom, stagingDom, path, ns);
    }
    default:
      throw new Error(`yract-beta: unknown SlotType: ${intent.type satisfies never}`);
  }
}

function mountEmptySlot(intent: DraftIntent<EmptySlotType>, stagingDom: Node, path: string) {
  const slot = createEmptySlot(intent, path);
  stagingDom.appendChild(slot.node);
  return slot;
}

function mountTextSlot(intent: DraftIntent<TextSlotType>, stagingDom: Node, path: string) {
  const slot = createTextSlot(intent, path);
  stagingDom.appendChild(slot.node);
  return slot;
}

function* mountFragmentSlot(
  intent: DraftIntent<FragmentSlotType>,
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
  const { keyIndex, slots } = yield* mount(
    intent.children,
    parentInstance,
    parentDom,
    stagingDom,
    path,
    ns,
  );
  stagingDom.appendChild(slot.endAnchor);
  slot.slots = slots;
  slot.keyIndex = keyIndex;
  return slot;
}

function* mountElementSlot(
  intent: DraftIntent<ElementSlotType>,
  stagingDom: Node,
  path: string,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, ElementSlot> {
  const slot = createElementSlot(intent, parentInstance.rctx.delegationRoot, path, ns);
  stagingDom.appendChild(slot.node);
  // Element children live inside the element — both logical parent and staging
  // target collapse to `slot.node` for the recursion.
  const { keyIndex, slots } = yield* mount(
    intent.children,
    parentInstance,
    slot.node,
    slot.node,
    path,
    slot.node.namespaceURI as TagNamespace,
  );
  if (isRefProps(intent.child.props)) yield $delegateRef(slot.node, intent.child.props.ref);
  slot.slots = slots;
  slot.keyIndex = keyIndex;
  return slot;
}

function* mountContextSlot(
  intent: DraftIntent<ContextSlotType>,
  parentDom: Node,
  stagingDom: Node,
  path: string,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, ContextSlot, BaseInstance<Context>> {
  const instance = yield $delegateMount(intent.child, path, parentDom, ns);
  stagingDom.appendChild(instance.startAnchor);
  stagingDom.appendChild(instance.endAnchor);
  return createContextSlot(intent, instance, path);
}

function* mountComponentSlot(
  intent: DraftIntent<ComponentSlotType>,
  parentDom: Node,
  stagingDom: Node,
  path: string,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, ComponentSlot, BaseInstance<Component>> {
  const instance = yield $delegateMount(intent.child, path, parentDom, ns);
  stagingDom.appendChild(instance.startAnchor);
  stagingDom.appendChild(instance.endAnchor);
  return createComponentSlot(intent, instance, path);
}
