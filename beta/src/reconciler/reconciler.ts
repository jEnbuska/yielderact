import type { Child, Component, VNode } from "../jsx";
import type { BaseInstance } from "../instances/base-instance";
import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  EmptySlot,
  EmptySlotType,
  FragmentSlotType,
  Slot,
  SlotType,
  TextSlot,
  TextSlotType,
} from "../slots/slot";
import {
  type ComponentSlot,
  componentSlotType,
  type ContextSlot,
  contextSlotType,
  type ElementSlot,
  elementSlotType,
  emptySlotType,
  type FragmentSlot,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";
import type { TagNamespace } from "../render/elements/namespaces";
import type {
  CreateSlotIntent,
  DelegationAction,
  OptionalDelegationAction,
  ReconcileResult,
  RenderSlotIntent,
} from "./types";
import { delegateRemovals, deriveStableIndexes, draftIntents, fillIntentDrafts } from "./prepare";
import {
  $delegateMount,
  $delegateProps,
  $delegateRef,
  $delegateUi,
  isRefProps,
  slotFirstNode,
  slotLastNode,
} from "./utils";
import { appendChildren, insertBefore, moveRange, setText } from "./dom-updates";
import type { ComponentInstance } from "../instances/component-instance";
import type { Context } from "yract-beta";
import {
  createComponentSlot,
  createContextSlot,
  createElementSlot,
  createEmptySlot,
  createFragmentSlot,
  createTextSlot,
} from "../slots/utils";
import { stage } from "../general";
import type { ContextInstance } from "../instances/context-instance";
import { mount } from "./mount";
import { diffElementProps, updateElementProps } from "../render/element-props";

export function* reconcile(
  children: Child[],
  parentInstance: BaseInstance,
  parentDom: Node,
  parentPath: string,
  prevSlots: Slot[] = [],
  prevKeyIndex: Map<string, number> = new Map(),
  ns: TagNamespace,
  beforeNode: Node | null,
): Generator<OptionalDelegationAction, ReconcileResult, BaseInstance> {
  const { drafts, keyIndex } = draftIntents(children);
  yield* delegateRemovals(keyIndex, prevKeyIndex, prevSlots);
  const stableIndexes = deriveStableIndexes(drafts, prevKeyIndex);
  yield;
  fillIntentDrafts(prevSlots, drafts, prevKeyIndex, stableIndexes);
  const intents = drafts;
  const slots: Array<Slot> = new Array(intents.length);
  for (let index = intents.length - 1; index >= 0; --index) {
    const intent = intents[index]!;
    if (intent.action === "CREATED") {
      slots[index] = yield* buildSlot(
        intent,
        parentPath,
        parentInstance,
        parentDom,
        beforeNode,
        ns,
      );
    } else {
      slots[index] = yield* updateSlot(intent, parentInstance, ns);
      if (intent.move) {
        yield $delegateUi(stage(moveSlot, slots, index, parentDom, beforeNode));
      }
    }
  }
  return { slots, keyIndex };
}

function moveSlot(slots: Slot[], index: number, parentDom: Node, beforeNode: Node | null): void {
  const slot = slots[index]!;
  const target = index + 1 < slots.length ? slotFirstNode(slots[index + 1]!) : beforeNode;
  const first = slotFirstNode(slot);
  const last = slotLastNode(slot);
  moveRange(first, last, parentDom, target);
}

function* buildSlot<T extends SlotType>(
  intent: CreateSlotIntent<T>,
  parentPath: string,
  parentInstance: BaseInstance,
  parentDom: Node,
  beforeNode: null | Node,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, Slot> {
  const path = `${parentPath}${intent.key}`;
  switch (intent.type) {
    case componentSlotType: {
      const p = intent as CreateSlotIntent<ComponentSlotType>;
      return yield* buildComponentSlot(p, path, parentDom, ns);
    }
    case elementSlotType: {
      const p = intent as CreateSlotIntent<ElementSlotType>;
      return yield* buildElementSlot(p, path, parentInstance, parentDom, beforeNode, ns);
    }
    case fragmentSlotType: {
      const p = intent as CreateSlotIntent<FragmentSlotType>;
      return yield* buildFragmentSlot(p, path, parentInstance, parentDom, ns);
    }
    case contextSlotType: {
      const p = intent as CreateSlotIntent<ContextSlotType>;
      return yield* buildContextSlot(p, path, parentDom, ns);
    }
    case textSlotType: {
      const p = intent as CreateSlotIntent<TextSlotType>;
      return yield* buildTextSlot(p, path, parentDom, beforeNode);
    }
    case emptySlotType: {
      const p = intent as CreateSlotIntent<EmptySlotType>;
      return yield* buildEmptySlot(p, path, parentDom, beforeNode);
    }
    default: {
      throw new Error(`yract-beta: unknown SlotType: ${intent.type satisfies never}`);
    }
  }
}

function* buildComponentSlot(
  intent: CreateSlotIntent<ComponentSlotType>,
  path: string,
  parentDom: Node,
  ns: TagNamespace,
): Generator<DelegationAction, ComponentSlot, ComponentInstance> {
  const instance = yield* mountInstance(intent.child, parentDom, path, ns);
  return createComponentSlot(intent, instance, path);
}

function* mountInstance<T extends Component | Context>(
  vnode: VNode<T>,
  parentDom: Node,
  path: string,
  ns: TagNamespace,
): Generator<DelegationAction, BaseInstance<T>, BaseInstance<T>> {
  const instance = yield $delegateMount(vnode, path, parentDom, ns);
  if (instance.parentDom !== parentDom) {
    // Reused instance migrating to a new DOM container — physically relocate
    // the whole subtree (anchors + everything between) so DOM and hook state
    // stay paired. `moveRange` walks `startAnchor.nextSibling` in the old
    // parent up to `endAnchor` and `insertBefore`s the lot into the new one.
    instance.parentDom = parentDom;
    yield $delegateUi(stage(moveRange, instance.startAnchor, instance.endAnchor, parentDom, null));
  } else {
    // Fresh instance — anchors were just created, not yet attached anywhere.
    yield $delegateUi(stage(appendChildren, parentDom, instance.startAnchor, instance.endAnchor));
  }
  return instance;
}

function* buildContextSlot(
  intent: CreateSlotIntent<ContextSlotType>,
  path: string,
  parentDom: Node,
  ns: TagNamespace,
): Generator<DelegationAction, ContextSlot, ContextInstance> {
  const instance = yield* mountInstance(intent.child, parentDom, path, ns);
  return createContextSlot(intent, instance, path);
}

function* buildElementSlot(
  prepared: CreateSlotIntent<ElementSlotType>,
  path: string,
  parentInstance: BaseInstance,
  parentDom: Node,
  beforeNode: null | Node,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, ElementSlot> {
  // Create node + apply props (node is unattached — no visible DOM change).
  const slot = createElementSlot(prepared, parentInstance.rctx.delegationRoot, path, ns);
  // Children mount directly INTO the detached element via sync `appendChild` —
  // since `slot.node` is unattached, the eager mutations don't affect live DOM
  // and we skip the per-child positioning queue that `build` would emit.
  const { keyIndex, slots } = yield* mount(
    prepared.children,
    parentInstance,
    slot.node,
    slot.node,
    path,
    slot.node.namespaceURI as TagNamespace,
  );

  if (isRefProps(slot.props)) yield $delegateRef(slot.node, slot.props.ref);

  yield $delegateUi(stage(insertBefore, parentDom, slot.node, beforeNode));
  slot.slots = slots;
  slot.keyIndex = keyIndex;
  return slot;
}

function* buildFragmentSlot(
  prepared: CreateSlotIntent<FragmentSlotType>,
  path: string,
  parentInstance: BaseInstance,
  parentDom: Node,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, FragmentSlot> {
  const slot = createFragmentSlot(prepared, path);
  const stagingDom = document.createDocumentFragment();
  // Anchors must be in the DOM before children can be positioned between them.
  yield $delegateUi(stage(appendChildren, parentDom, stagingDom));
  stagingDom.appendChild(slot.node);
  // Recursively reconcile children between the anchors.
  const { keyIndex, slots } = yield* mount(
    prepared.children,
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

export function* buildTextSlot(
  intent: CreateSlotIntent<TextSlotType>,
  path: string,
  parentDom: Node,
  beforeNode: null | Node,
): Generator<OptionalDelegationAction, TextSlot> {
  const slot = createTextSlot(intent, path);
  yield $delegateUi(stage(insertBefore, parentDom, slot.node, beforeNode));
  return slot;
}

export function* buildEmptySlot(
  intent: CreateSlotIntent<EmptySlotType>,
  path: string,
  parentDom: Node,
  beforeNode: null | Node,
): Generator<OptionalDelegationAction, EmptySlot> {
  const slot = createEmptySlot(intent, path);
  yield $delegateUi(stage(insertBefore, parentDom, slot.node, beforeNode));
  return slot;
}

function* updateSlot<T extends SlotType>(
  intent: RenderSlotIntent<T>,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, Slot<T>> {
  switch (intent.type) {
    case componentSlotType:
    case contextSlotType: {
      const p = intent as RenderSlotIntent<ContextSlotType | ComponentSlotType>;
      const slot = yield* updateInstance(p);
      return slot as Slot<T>;
    }
    case textSlotType: {
      const p = intent as RenderSlotIntent<TextSlotType>;
      const slot = yield* updateText(p);
      return slot as Slot<T>;
    }
    case elementSlotType: {
      const p = intent as RenderSlotIntent<ElementSlotType>;
      const slot = yield* updateElement(p, parentInstance, ns);
      return slot as Slot<T>;
    }
    case fragmentSlotType: {
      const p = intent as RenderSlotIntent<FragmentSlotType>;
      const slot = yield* updateFragment(p, parentInstance, ns);
      return slot as Slot<T>;
    }
    case emptySlotType:
      return intent.prev;
    default:
      throw new Error(`Unhandled update slot ${intent.type}`);
  }
}

function* updateFragment(
  intent: RenderSlotIntent<FragmentSlotType>,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, FragmentSlot> {
  const parentDom = intent.prev.node.parentNode;
  if (!parentDom) {
    throw new Error("yract-beta: fragment slot reconciled with detached start anchor");
  }
  // Reuse prev.path — matching key means the path value is unchanged.

  const { slots, keyIndex } = yield* reconcile(
    intent.children,
    parentInstance,
    parentDom,
    intent.prev.path,
    intent.prev.slots,
    intent.prev.keyIndex,
    ns,
    intent.prev.endAnchor,
  );
  const slot = { ...intent.prev };
  slot.index = intent.index;
  slot.slots = slots;
  slot.keyIndex = keyIndex;
  slot.props = intent.child.props;
  return slot;
}

function* updateElement(
  intent: RenderSlotIntent<ElementSlotType>,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, ElementSlot> {
  const { slots, keyIndex } = yield* reconcile(
    intent.children,
    parentInstance,
    intent.prev.node,
    intent.prev.path,
    intent.prev.slots,
    intent.prev.keyIndex,
    ns,
    null,
  );
  const patch = diffElementProps(intent.prev.props, intent.child.props);
  if (isRefProps(intent.child.props)) {
    yield $delegateRef(intent.prev.node, intent.child.props.ref);
  }

  if (patch) {
    yield $delegateUi(
      stage(updateElementProps, intent.prev.node, patch, parentInstance.rctx.delegationRoot),
    );
  }
  const slot: ElementSlot = { ...intent.prev };
  slot.keyIndex = keyIndex;
  slot.slots = slots;
  slot.index = intent.index;
  slot.props = intent.child.props;
  return slot;
}

function* updateInstance(
  intent: RenderSlotIntent<ContextSlotType | ComponentSlotType>,
): Generator<DelegationAction, ComponentSlot | ContextSlot> {
  yield $delegateProps(intent.prev.instance, intent.child);
  const slot = { ...intent.prev };
  slot.props = intent.child.props;
  slot.index = intent.index;
  return slot;
}

function* updateText(
  intent: RenderSlotIntent<TextSlotType>,
): Generator<DelegationAction, TextSlot> {
  const { prev, index } = intent;
  const text = String(intent.child);
  if (text === intent.prev.text) {
    if (index === prev.index) return intent.prev;
  } else {
    yield $delegateUi(stage(setText, intent.prev.node, text));
  }
  const slot = { ...intent.prev };
  slot.text = text;
  slot.index = intent.index;
  return slot;
}
