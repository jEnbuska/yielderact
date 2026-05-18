import type { Child, Component, SingleChild, VNode } from "../jsx";
import type { BaseInstance } from "../instances/base-instance";
import type {
  ComponentSlotType,
  ContextSlotType,
  CreateSlotIntent,
  ElementSlotType,
  FragmentSlotType,
  RenderSlotIntent,
  Slot,
  SlotIntent,
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
  type FragmentSlot,
  fragmentSlotType,
  textSlotType,
} from "../slots/slot";
import type { TagNamespace } from "../render/elements/namespaces";
import { nodeNameSpace } from "../render/elements/namespaces";
import type { DelegationAction, OptionalDelegationAction } from "./types";
import { createDraftIntent, delegateRemovals, draftIntents, fillIntentDrafts } from "./prepare";
import { delegateMount, delegateProps, delegateRef, delegateUi, isRefProps, slotFirstNode, } from "./utils";
import { insertBefore, moveSlot, removeSlotNodes, setText } from "./dom-updates";
import type { ComponentInstance } from "../instances/component-instance";
import type { Context } from "yract-beta";
import {
  createComponentSlot,
  createContextSlot,
  createElementSlot,
  createFragmentSlot,
  createTextSlot,
} from "../slots/utils";
import { getValuesReversed, stage } from "../general";
import type { ContextInstance } from "../instances/context-instance";
import { mount } from "./mount";
import { diffElementProps, updateElementProps } from "../render/element-props";
import { deriveStableIndexes } from "./derive-stable-indexes";
import { getChildKey, getChildType } from "../child";

export function* reconcile(
  children: Child[],
  parentInstance: BaseInstance,
  parentDom: Node,
  parentPath: string,
  oldSlots: Map<string, Slot> = new Map(),
  ns: TagNamespace,
  beforeNode: Node | null,
): Generator<OptionalDelegationAction, Map<string, Slot>, BaseInstance> {
  const drafts = draftIntents(children);
  yield* delegateRemovals(drafts, oldSlots);
  const stableIndexes = deriveStableIndexes(drafts, oldSlots);
  yield;
  fillIntentDrafts(oldSlots, drafts, stableIndexes);

  const intents = drafts;

  for (const intent of getValuesReversed<SlotIntent>(intents)) {
    let slot: Slot;
    if (intent.action === "CREATED") {
      slot = yield* buildSlot(intent, parentPath, parentInstance, parentDom, beforeNode, ns);
    } else {
      slot = yield* updateSlot(intent, parentInstance, ns);
      if (intent.move) {
        yield delegateUi(stage(moveSlot, slot, parentDom, beforeNode));
      }
    }
    intents.set(slot.key, slot);
    beforeNode = slotFirstNode(slot);
  }
  return intents as Map<string, Slot>;
}

export function* reconcileRoot(
  child: SingleChild,
  parentInstance: BaseInstance,
  parentDom: Node,
  old: Slot,
  ns: TagNamespace,
  beforeNode: Node | null,
): Generator<OptionalDelegationAction, { slot: Slot; key: string }, BaseInstance> {
  const type = getChildType(child);
  const key = getChildKey(child, 0, type);
  const draft = createDraftIntent(type, child, key, 0);
  let slot: Slot;
  if (key !== old.key) {
    yield delegateUi(stage(removeSlotNodes, old));
    const intent = draft as CreateSlotIntent;
    intent.action = "CREATED";
    slot = yield* buildSlot(intent, "", parentInstance, parentDom, beforeNode, ns);
  } else {
    const intent = draft as any as RenderSlotIntent;
    intent.action = "RENDERED";
    intent.old = old;
    slot = yield* updateSlot(intent, parentInstance, ns);
  }
  return { slot, key };
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
      return yield* buildComponentSlot(p, path, parentDom, beforeNode, ns);
    }
    case textSlotType: {
      const p = intent as CreateSlotIntent<TextSlotType>;
      return yield* buildTextSlot(p, path, parentDom, beforeNode);
    }
    case elementSlotType: {
      const p = intent as CreateSlotIntent<ElementSlotType>;
      return yield* buildElementSlot(p, path, parentInstance, parentDom, beforeNode, ns);
    }
    case fragmentSlotType: {
      const p = intent as CreateSlotIntent<FragmentSlotType>;
      return yield* buildFragmentSlot(p, path, parentInstance, parentDom, beforeNode, ns);
    }
    case contextSlotType: {
      const p = intent as CreateSlotIntent<ContextSlotType>;
      return yield* buildContextSlot(p, path, parentDom, beforeNode, ns);
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
  beforeNode: Node | null,
  ns: TagNamespace,
): Generator<DelegationAction, ComponentSlot, ComponentInstance> {
  const instance = yield* mountInstance(intent.child, parentDom, path, beforeNode, ns);
  return createComponentSlot(intent, instance, path);
}

function* mountInstance<T extends Component | Context>(
  vnode: VNode<T>,
  parentDom: Node,
  path: string,
  beforeNode: Node | null,
  ns: TagNamespace,
): Generator<DelegationAction, BaseInstance<T>, BaseInstance<T>> {
  const instance = yield delegateMount(vnode, path, parentDom, ns);
  /*if (instance.parentDom !== parentDom) {
    throw new Error("THIS SHOULD NEVER HAPPEN");
    // Reused instance migrating to a new DOM container — physically relocate
    // the whole subtree (anchors + everything between) so DOM and hook state
    // stay paired. `moveRange` walks `startAnchor.nextSibling` in the old
    // parent up to `endAnchor` and `insertBefore`s the lot into the new one.
    instance.parentDom = parentDom;
    yield $delegateUi(
      stage(moveRange, instance.startAnchor!, instance.endAnchor, parentDom, beforeNode),
    );
  } else {*/
  // Fresh instance — anchors were just created, not yet attached anywhere.
  const fragment = document.createDocumentFragment();
  fragment.append(instance.startAnchor, instance.endAnchor);
  yield delegateUi(stage(insertBefore, parentDom, fragment, beforeNode));
  //}
  return instance;
}

function* buildContextSlot(
  intent: CreateSlotIntent<ContextSlotType>,
  path: string,
  parentDom: Node,
  beforeNode: Node | null,
  ns: TagNamespace,
): Generator<DelegationAction, ContextSlot, ContextInstance> {
  const instance = yield* mountInstance(intent.child, parentDom, path, beforeNode, ns);
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
  const slots = yield* mount(
    prepared.children,
    parentInstance,
    slot.node,
    slot.node,
    path,
    nodeNameSpace(slot.node),
  );

  if (isRefProps(slot.props)) yield delegateRef(slot.node, slot.props.ref);

  yield delegateUi(stage(insertBefore, parentDom, slot.node, beforeNode));
  slot.slots = slots;
  return slot;
}

function* buildFragmentSlot(
  prepared: CreateSlotIntent<FragmentSlotType>,
  path: string,
  parentInstance: BaseInstance,
  parentDom: Node,
  beforeNode: Node | null,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, FragmentSlot> {
  const slot = createFragmentSlot(prepared, path);
  const stagingDom = document.createDocumentFragment();
  stagingDom.appendChild(slot.node);
  stagingDom.appendChild(slot.endAnchor);
  // Recursively reconcile children between the anchors.
  const slots = yield* mount(prepared.children, parentInstance, parentDom, stagingDom, path, ns);
  yield delegateUi(stage(insertBefore, parentDom, stagingDom, beforeNode));
  slot.slots = slots;
  return slot;
}

export function* buildTextSlot(
  intent: CreateSlotIntent<TextSlotType>,
  path: string,
  parentDom: Node,
  beforeNode: null | Node,
): Generator<OptionalDelegationAction, TextSlot> {
  const slot = createTextSlot(intent, path);
  yield delegateUi(stage(insertBefore, parentDom, slot.node, beforeNode));
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
      const slot = yield* updateElement(p, parentInstance);
      return slot as Slot<T>;
    }
    case fragmentSlotType: {
      const p = intent as RenderSlotIntent<FragmentSlotType>;
      const slot = yield* updateFragment(p, parentInstance, ns);
      return slot as Slot<T>;
    }
    default:
      throw new Error(`Unhandled update slot ${intent.type}`);
  }
}

function* updateFragment(
  intent: RenderSlotIntent<FragmentSlotType>,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, FragmentSlot> {
  const parentDom = intent.old.node.parentNode;
  if (!parentDom) {
    throw new Error("yract-beta: fragment slot reconciled with detached start anchor");
  }
  // Reuse prev.path — matching key means the path value is unchanged.

  const slots = yield* reconcile(
    intent.children,
    parentInstance,
    parentDom,
    intent.old.path,
    intent.old.slots,
    ns,
    intent.old.endAnchor,
  );
  const slot = { ...intent.old };
  slot.index = intent.index;
  slot.slots = slots;
  slot.props = intent.props;
  return slot;
}

function* updateElement(
  intent: RenderSlotIntent<ElementSlotType>,
  parentInstance: BaseInstance,
): Generator<OptionalDelegationAction, ElementSlot> {
  const slots = yield* reconcile(
    intent.children,
    parentInstance,
    intent.old.node,
    intent.old.path,
    intent.old.slots,
    nodeNameSpace(intent.old.node),
    null,
  );
  const patch = diffElementProps(intent.old.props, intent.props);
  if (isRefProps(intent.props)) {
    yield delegateRef(intent.old.node, intent.props.ref);
  }

  if (patch) {
    yield delegateUi(
      stage(updateElementProps, intent.old.node, patch, parentInstance.rctx.delegationRoot),
    );
  }
  const slot: ElementSlot = { ...intent.old };
  slot.slots = slots;
  slot.index = intent.index;
  slot.props = intent.props;
  return slot;
}

function* updateInstance(
  intent: RenderSlotIntent<ContextSlotType | ComponentSlotType>,
): Generator<DelegationAction, ComponentSlot | ContextSlot> {
  yield delegateProps(intent.old.instance, intent.child);
  const slot = { ...intent.old };
  slot.props = intent.props;
  slot.index = intent.index;
  return slot;
}

function* updateText(
  intent: RenderSlotIntent<TextSlotType>,
): Generator<DelegationAction, TextSlot> {
  const { old, text } = intent;
  if (text !== old.text) yield delegateUi(stage(setText, old.node, text));
  const slot = { ...old };
  slot.text = text;
  return slot;
}
