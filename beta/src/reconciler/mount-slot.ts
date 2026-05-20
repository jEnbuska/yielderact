import type { SlotIntent } from "../slots/slot";
import {
  type ComponentSlotType,
  componentSlotType,
  type ContextSlotType,
  contextSlotType,
  type ElementSlotType,
  elementSlotType,
  type FragmentSlotType,
  fragmentSlotType,
  type TextSlotType,
  textSlotType,
} from "../slots/slot";
import type { BaseInstance } from "../instances/base-instance";
import type { TagNamespace } from "../render/elements/namespaces";
import { nodeNameSpace } from "../render/elements/namespaces";
import type { OptionalDelegationAction } from "./types";
import type { Component, Context } from "yract-beta";
import { delegateMount, delegateRef, isRefProps } from "./delegation";
import {
  toComponentSlot,
  toContextSlot,
  toElementSlot,
  toFragmentSlot,
  toTextSlot,
} from "../slots/utils";

import { mount } from "./reconciler";

/** Converts SlotIntent<T> to Slot<T>*/
export function mountSlot(
  intent: SlotIntent,
  parentInstance: BaseInstance,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, void> {
  switch (intent.type) {
    case componentSlotType: {
      return mountComponentSlot(intent as SlotIntent<ComponentSlotType>, parentDom, stagingDom, ns);
    }
    case textSlotType: {
      return mountTextSlot(intent as SlotIntent<TextSlotType>, stagingDom);
    }
    case elementSlotType: {
      return mountElementSlot(
        intent as SlotIntent<ElementSlotType>,
        stagingDom,
        parentInstance,
        ns,
      );
    }
    case fragmentSlotType: {
      return mountFragmentSlot(
        intent as SlotIntent<FragmentSlotType>,
        parentDom,
        stagingDom,
        parentInstance,
        ns,
      );
    }
    case contextSlotType: {
      return mountContextSlot(intent as SlotIntent<ContextSlotType>, parentDom, stagingDom, ns);
    }
    default:
      throw new Error(`yract-beta: unknown SlotType: ${intent.type satisfies never}`);
  }
}

function* mountFragmentSlot(
  intent: SlotIntent<FragmentSlotType>,
  parentDom: Node,
  stagingDom: Node,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, void> {
  toFragmentSlot(intent);
  const { path, children, headNode, tailNode } = intent;
  stagingDom.appendChild(headNode);
  // Children stage alongside the fragment's anchors but their `instance.parentDom`
  // tracks the real outer parent — when the staging fragment commits, the children's
  // anchors land as siblings inside the real parent.

  intent.slots = yield* mount(children, parentInstance, parentDom, stagingDom, path, ns);
  stagingDom.appendChild(tailNode);
}

function* mountElementSlot(
  intent: SlotIntent<ElementSlotType>,
  stagingDom: Node,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, void> {
  toElementSlot(intent, parentInstance.rctx.delegationRoot, ns);
  const { headNode, children, path, props } = intent;
  stagingDom.appendChild(headNode);
  // Element children live inside the element — both logical parent and staging
  // target collapse to `slot.node` for the recursion.
  ns = nodeNameSpace(headNode);
  intent.slots = yield* mount(children, parentInstance, headNode, headNode, path, ns);
  if (isRefProps(props)) yield delegateRef(headNode, props.ref);
}

function* mountContextSlot(
  intent: SlotIntent<ContextSlotType>,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, void, BaseInstance<Context>> {
  const { child, path } = intent;
  const instance = yield delegateMount(child, path, parentDom, ns);
  toContextSlot(intent, instance);
  const { headNode, tailNode } = intent;
  stagingDom.appendChild(headNode);
  stagingDom.appendChild(tailNode);
}

function* mountComponentSlot(
  intent: SlotIntent<ComponentSlotType>,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
): Generator<OptionalDelegationAction, void, BaseInstance<Component>> {
  const { child, path } = intent;
  const instance = yield delegateMount(child, path, parentDom, ns);
  toComponentSlot(intent, instance);
  const { headNode, tailNode } = intent;
  stagingDom.appendChild(headNode);
  stagingDom.appendChild(tailNode);
}

function* mountTextSlot(intent: SlotIntent<TextSlotType>, stagingDom: Node) {
  toTextSlot(intent);
  stagingDom.appendChild(intent.headNode);
}

/*
function* mountInstance<T extends Component | Context>(
  vnode: VNode<T>,
  parentDom: Node,
  path: string,
  beforeNode: Node | null,
  ns: TagNamespace,
): Generator<DelegationAction, BaseInstance<T>, BaseInstance<T>> {
  const instance = yield delegateMount(vnode, path, parentDom, ns);*/
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
// const fragment = document.createDocumentFragment();
// fragment.append(instance.startAnchor, instance.endAnchor);
// yield delegateUi(stage(insertBefore, parentDom, fragment, beforeNode));
//}
/*return instance;
}*/
