import type { InstanceSlotNodes, SlotIntent } from "../slots/slot";
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
import type { DelegateMount, DelegateRef } from "./delegation";
import { deferRef, delegateMount, isRefProps } from "./delegation";
import { toElementSlot, toFragmentSlot, toTextSlot } from "../slots/utils";

import { mount } from "./reconciler";

/** Converts SlotIntent<T> to Slot<T>*/
export function mountIntent(
  intent: SlotIntent,
  parentInstance: BaseInstance,
  ns: TagNamespace,
  parentDom: Node,
  stagingDom: Node,
): Generator<DelegateMount | DelegateRef, void> {
  switch (intent.type) {
    case componentSlotType:
    case contextSlotType:
      return mountInstanceIntent(intent, parentDom, stagingDom, ns);
    case textSlotType:
      return mountTextIntent(intent, stagingDom);
    case elementSlotType:
      return mountElementIntent(intent, stagingDom, parentInstance, ns);
    case fragmentSlotType:
      return mountFragmentIntent(intent, parentDom, stagingDom, parentInstance, ns);
    default:
      throw new Error(`yract-beta: unknown SlotType: ${intent satisfies never}`);
  }
}

function* mountFragmentIntent(
  intent: SlotIntent<FragmentSlotType>,
  parentDom: Node,
  stagingDom: Node,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<DelegateMount | DelegateRef, void> {
  toFragmentSlot(intent);
  const { path, children, headNode, tailNode } = intent;
  stagingDom.appendChild(headNode);
  intent.slots = yield* mount(children, parentInstance, parentDom, stagingDom, path, ns);
  stagingDom.appendChild(tailNode);
}

function* mountElementIntent(
  intent: SlotIntent<ElementSlotType>,
  stagingDom: Node,
  parentInstance: BaseInstance,
  ns: TagNamespace,
): Generator<DelegateMount | DelegateRef, void> {
  toElementSlot(intent, parentInstance.rctx.delegationRoot, ns);
  const { headNode, children, path, props } = intent;
  stagingDom.appendChild(headNode);
  ns = nodeNameSpace(headNode);
  intent.slots = yield* mount(children, parentInstance, headNode, headNode, path, ns);
  if (isRefProps(props)) yield deferRef(headNode, props.ref);
}

function* mountInstanceIntent<T extends ContextSlotType | ComponentSlotType>(
  intent: SlotIntent<T>,
  parentDom: Node,
  stagingDom: Node,
  ns: TagNamespace,
): Generator<DelegateMount, void, InstanceSlotNodes> {
  const { headNode, tailNode } = yield delegateMount(intent, parentDom, ns);
  stagingDom.appendChild(headNode);
  stagingDom.appendChild(tailNode);
}

function* mountTextIntent(intent: SlotIntent<TextSlotType>, stagingDom: Node) {
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
