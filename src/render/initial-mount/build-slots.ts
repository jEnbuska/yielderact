/**
 * build-slots.ts — Build initial Slot array from VNode children.
 *
 * Used only during initial mount. Creates Slot objects for each child
 * without any diffing — there are no previous slots to compare against.
 *
 * For subsequent rerenders, the reconciler's `reconcileSlotsGen` handles
 * diffing against previous slots.
 */

import type { Child, Component, InternalProps, VNode } from "../../jsx";
import { Portal } from "../../jsx";
import { acquirePortalDelegation } from "../delegation";
import { driveWithContext, getContextMap, type RenderGenerator } from "../driver";
import {
  childContextMap,
  contextEntries,
  flattenChildren,
  isComponentNode,
  isElementNode,
  propsWithChildren,
  stripDeferred,
  stripFrameworkDirectives,
} from "../helpers";
import { applyProps } from "../props";
import { SchedulerCtx } from "../scheduler";
import type { Slot } from "../types";
import { buildNode } from "./build-node";
import { mountComponent } from "./mount-component";

/**
 * Build a Slot array for initial mount — no previous slots, no diffing.
 *
 * Each child is built fresh and inserted before `beforeAnchor` in `parent`.
 */
export function* buildInitialSlotsGen(
  parent: Node,
  nextVNodes: Child[],
  beforeAnchor: Node | undefined,
): RenderGenerator<Slot[]> {
  const flatNext = flattenChildren(nextVNodes);
  const slots: Slot[] = [];

  for (let i = 0; i < flatNext.length; i++) {
    const child = flatNext[i] as Child;
    const { slot, node } = yield* buildOneSlot(child, i);
    slots.push(slot);
    if (beforeAnchor) {
      parent.insertBefore(node, beforeAnchor);
    } else {
      parent.appendChild(node);
    }
    yield;
  }

  return slots;
}

/**
 * Build a single fresh slot from a Child.
 *
 * Same VNode type dispatch as the reconciler's `reconcileOneGen`, but
 * without any previous-slot diffing or replacement logic.
 */
function* buildOneSlot(
  nextChild: Child,
  index: number,
): RenderGenerator<{ slot: Slot; node: Node }> {
  const ctxMap = yield* getContextMap();

  // Empty / null
  if (nextChild == null || typeof nextChild === "boolean") {
    const node = document.createTextNode("");
    return { slot: { type: "empty", node, props: {}, childSlots: [] }, node };
  }

  // Primitive (text / number)
  if (typeof nextChild === "string" || typeof nextChild === "number") {
    const text = String(nextChild);
    const node = document.createTextNode(text);
    return { slot: { type: "text", node, props: { text }, childSlots: [] }, node };
  }

  // $shown === false
  const allProps = propsWithChildren(nextChild);
  if (allProps.$shown === false) {
    const node = document.createTextNode("");
    return { slot: { type: "empty", node, props: {}, childSlots: [] }, node };
  }

  // Portal
  if (nextChild.type === Portal) {
    return yield* buildPortalSlot(nextChild);
  }

  // Component
  if (isComponentNode(nextChild)) {
    return yield* buildComponentSlot(nextChild, allProps, index);
  }

  // HTML element
  if (isElementNode(nextChild)) {
    return yield* buildElementSlot(nextChild);
  }

  // Fallback (Fragment or unknown)
  const node = yield* driveWithContext(ctxMap, buildNode(nextChild));
  return { slot: { type: nextChild.type, node, props: {}, childSlots: [] }, node };
}

/** Mount a fresh component and return its slot. */
function* buildComponentSlot(
  vnode: VNode<Component>,
  allPropsRaw: InternalProps,
  index: number,
): RenderGenerator<{ slot: Slot; node: Node }> {
  const ctxMap = yield* getContextMap();
  const componentProps = stripFrameworkDirectives(allPropsRaw);
  const slotProps = stripDeferred(allPropsRaw);
  const childCtxMap = childContextMap(ctxMap, allPropsRaw);

  const { fragment, instance } = yield* driveWithContext(
    childCtxMap,
    mountComponent(vnode.type, componentProps, index),
  );
  const entries = contextEntries(allPropsRaw.$context);
  for (const entry of entries) {
    instance.providedContexts.add(entry.ctx);
  }
  return {
    slot: {
      type: vnode.type,
      node: instance.endMarker,
      props: slotProps,
      childSlots: [],
      instance,
    },
    node: fragment,
  };
}

/** Build a fresh HTML element slot with children. */
function* buildElementSlot(vnode: VNode<string>): RenderGenerator<{ slot: Slot; node: Node }> {
  const ctxMap = yield* getContextMap();
  const childCtxMap = childContextMap(ctxMap, vnode.props);

  const scheduler = ctxMap.get(SchedulerCtx);
  const el = document.createElement(vnode.type);
  applyProps(el, vnode.props, scheduler.delegationRoot);
  const childSlots: Slot[] = [];
  const flatChildren = flattenChildren(vnode.children);
  for (let i = 0; i < flatChildren.length; i++) {
    const child = flatChildren[i] as Child;
    const { slot: childSlot, node: childNode } = yield* driveWithContext(
      childCtxMap,
      buildOneSlot(child, i),
    );
    childSlots.push(childSlot);
    el.appendChild(childNode);
  }
  return {
    slot: { type: vnode.type, node: el, props: vnode.props, childSlots },
    node: el,
  };
}

/** Build a fresh portal slot. */
function* buildPortalSlot(vnode: VNode): RenderGenerator<{ slot: Slot; node: Node }> {
  const ctxMap = yield* getContextMap();
  const scheduler = ctxMap.get(SchedulerCtx);
  const portalContainer = vnode.props["$portalContainer"] as Element;

  const placeholder = document.createComment("portal");
  const endMarker = document.createComment("");
  portalContainer.appendChild(endMarker);

  const delegation = acquirePortalDelegation(portalContainer, scheduler);
  const { delegationRoot: prevDelegation } = scheduler;
  scheduler.delegationRoot = delegation;

  const childSlots: Slot[] = [];
  try {
    const flatChildren = flattenChildren(vnode.children);
    for (let i = 0; i < flatChildren.length; i++) {
      const child = flatChildren[i] as Child;
      const { slot, node } = yield* driveWithContext(ctxMap, buildOneSlot(child, i));
      childSlots.push(slot);
      portalContainer.insertBefore(node, endMarker);
    }
  } finally {
    scheduler.delegationRoot = prevDelegation;
  }

  return {
    slot: {
      type: Portal,
      node: placeholder,
      props: vnode.props,
      childSlots,
      portalContainer,
      portalEndMarker: endMarker,
      portalDelegationRoot: delegation,
    },
    node: placeholder,
  };
}
