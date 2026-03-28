/**
 * reconciler.ts — Positional reconciliation of DOM children against new VNodes.
 *
 * Compares the previous Slot array against new VNodes and applies minimal
 * DOM mutations: skip (same type + same props), update in place, replace
 * (type change), remove (extra old slots), or append (extra new VNodes).
 *
 * Generator functions (`reconcileSlotsGen`, `reconcileOneGen`,
 * `reconcileKeyedSlotsGen`) yield between children. The sync wrapper
 * `reconcileSlots` drains them immediately via `runToCompletion`.
 *
 * Context is obtained via `yield* getContextMap()`. Subtrees needing a
 * different context (e.g. `$context`) run in an isolated scope via
 * `runToCompletion(gen, childCtxMap)`.
 */

import { type Context, resolveCtx } from "../context";
import { depsChanged } from "../hooks";
import { $USE_CONTEXT } from "../hooks/descriptors";
import type { Child, Component, InternalProps, VNode } from "../jsx";
import { Portal } from "../jsx";
import {
  domAppendChild,
  domEnqueue,
  domInsertBefore,
  domRemoveChild,
  domSetText,
} from "./commit-queue";
import { acquirePortalDelegation } from "./delegation";
import { driveWithContext, getContextMap } from "./driver";
import {
  childContextMap,
  contextEntries,
  flattenChildren,
  isComponentNode,
  isElementNode,
  isVNode,
  propsWithChildren,
  shallowEqual,
  stripDeferred,
  stripFrameworkDirectives,
} from "./helpers";
import { propagateContextUpdate, unmountSlot } from "./hooks-runtime";
import { buildNode, mountComponent } from "./initial-mount";
import { applyProps, updateProps } from "./props";
import { SchedulerCtx } from "./scheduler";
import type { ComponentInstance, Slot } from "./types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively remove all DOM nodes owned by a slot from the given parent.
 *
 * For component slots, this removes all output nodes (tracked in
 * `instance.slots`) and the slot's own node (the endMarker Comment).
 * For Provider slots, this removes all child nodes (tracked in `childSlots`)
 * and the slot's own node (the endMarker Comment).
 * For HTML element and text slots, this simply removes `slot.node`.
 *
 * The `parentNode === parent` check ensures we only remove nodes that are
 * direct children of `parent` — nested nodes inside HTML elements are removed
 * automatically when their parent element is removed.
 *
 * **Called by:** `reconcileSlots` — when replacing or removing slots.
 *
 * @param parent - The DOM element to remove nodes from.
 * @param slot   - The slot whose nodes to remove.
 */
function removeSlotNodes(parent: Node, slot: Slot, ops: (() => void)[] | undefined): void {
  if (slot.portalContainer) {
    // Remove children from the portal container, not from the source parent.
    for (const child of slot.childSlots) {
      for (const node of collectSlotDOMNodes(child)) {
        domRemoveChild(slot.portalContainer, node, ops);
      }
    }
    // Remove the endMarker from portal container.
    if (slot.portalEndMarker) {
      domRemoveChild(slot.portalContainer, slot.portalEndMarker, ops);
    }
    // Remove the placeholder from the source tree.
    domRemoveChild(parent, slot.node, ops);
    return;
  }
  for (const node of collectSlotDOMNodes(slot)) {
    domRemoveChild(parent, node, ops);
  }
}

/**
 * Extract the `key` prop from a VNode child.
 *
 * Returns `undefined` for primitives, null, false, and VNodes without a key.
 */
function getChildKey(child: Child): string | undefined {
  if (!isVNode(child)) return undefined;
  return child.props.key;
}

/**
 * Returns `true` when at least one child in the list has a `key` prop.
 */
function hasKeyedChildren(children: Child[]): boolean {
  for (const child of children) {
    if (getChildKey(child) !== undefined) return true;
  }
  return false;
}

/**
 * Collect all top-level DOM nodes owned by a slot within its parent.
 *
 * For components: all output slot nodes (recursively) + endMarker.
 * For Providers: all child slot nodes (recursively) + endMarker.
 * For HTML elements, text, empty: just the single node.
 */
function collectSlotDOMNodes(slot: Slot): Node[] {
  // Portal slots: only the placeholder Comment lives in the source tree.
  if (slot.portalContainer) {
    return [slot.node];
  }
  if (slot.instance) {
    const nodes: Node[] = [];
    for (const child of slot.instance.slots) {
      nodes.push(...collectSlotDOMNodes(child));
    }
    nodes.push(slot.node);
    return nodes;
  }
  if (slot.node instanceof Comment && slot.childSlots.length > 0) {
    const nodes: Node[] = [];
    for (const child of slot.childSlots) {
      nodes.push(...collectSlotDOMNodes(child));
    }
    nodes.push(slot.node);
    return nodes;
  }
  return [slot.node];
}

// ── Keyed reconciliation (generator) ────────────────────────────────────────

/**
 * Keyed reconciliation: match children by `key` prop instead of position.
 *
 * 1. Build a key→index map from keyed previous slots.
 * 2. Collect non-keyed previous slots for positional fallback.
 * 3. For each new child: keyed → match by key; non-keyed → match
 *    positionally against non-keyed prev slots.
 * 4. Unmount any unused previous slots.
 * 5. Reorder DOM nodes so they appear in the new child order.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: keyed reconciliation with reuse/reorder/remove phases
function* reconcileKeyedSlotsGen(
  parent: HTMLElement | Node,
  prevSlots: Slot[],
  flatNext: Child[],
  beforeAnchor: Node | undefined,
): Generator<unknown, Slot[], unknown> {
  const ctxMap = yield* getContextMap();
  const scheduler = ctxMap.get(SchedulerCtx);
  // Build key → prevIndex map for keyed prev slots,
  // and collect non-keyed prev slot indices for positional matching.
  const prevKeyMap = new Map<string | number, number>();
  const nonKeyedPrevIndices: number[] = [];
  for (let i = 0; i < prevSlots.length; i++) {
    const key = prevSlots[i]?.props.key;
    if (key !== undefined) {
      prevKeyMap.set(key, i);
    } else {
      nonKeyedPrevIndices.push(i);
    }
  }

  const nextSlots: Slot[] = [];
  const usedPrevIndices = new Set<number>();
  const freshNodes = new Map<number, Node>();
  let nonKeyedCursor = 0;

  for (let i = 0; i < flatNext.length; i++) {
    const nextChild = flatNext[i] as Child;
    const nextKey = getChildKey(nextChild);

    let matchedPrevSlot: Slot | undefined;

    if (nextKey !== undefined && prevKeyMap.has(nextKey)) {
      // Keyed match
      // SAFETY: guarded by prevKeyMap.has(nextKey) above
      const prevIndex = prevKeyMap.get(nextKey) as number;
      if (!usedPrevIndices.has(prevIndex)) {
        matchedPrevSlot = prevSlots[prevIndex];
        usedPrevIndices.add(prevIndex);
      }
    } else if (nextKey === undefined) {
      // Non-keyed: match positionally against non-keyed prev slots
      while (nonKeyedCursor < nonKeyedPrevIndices.length) {
        const prevIndex = nonKeyedPrevIndices[nonKeyedCursor++] as number;
        if (!usedPrevIndices.has(prevIndex)) {
          matchedPrevSlot = prevSlots[prevIndex];
          usedPrevIndices.add(prevIndex);
          break;
        }
      }
    }

    if (matchedPrevSlot) {
      const { slot, node, replaced } = yield* reconcileOneGen(matchedPrevSlot, nextChild);
      nextSlots.push(slot);
      if (replaced) {
        // Type changed — unmount old slot, track new node for insertion
        unmountSlot(matchedPrevSlot);
        removeSlotNodes(parent, matchedPrevSlot, scheduler.ops);
        freshNodes.set(i, node);
      }
    } else {
      const { slot, node, replaced } = yield* reconcileOneGen(undefined, nextChild);
      nextSlots.push(slot);
      if (replaced) {
        freshNodes.set(i, node);
      }
    }
    yield;
  }

  // Unmount unused prev slots
  for (let i = 0; i < prevSlots.length; i++) {
    if (!usedPrevIndices.has(i)) {
      // SAFETY: i is bounded by prevSlots.length
      unmountSlot(prevSlots[i] as Slot);
      removeSlotNodes(parent, prevSlots[i] as Slot, scheduler.ops);
    }
  }

  // Reorder DOM: move/insert all slots' nodes into correct order
  const anchor = beforeAnchor ?? null;
  for (let i = 0; i < nextSlots.length; i++) {
    const freshNode = freshNodes.get(i);
    if (freshNode) {
      domInsertBefore(parent, freshNode, anchor, scheduler.ops);
    } else {
      for (const n of collectSlotDOMNodes(nextSlots[i] as Slot)) {
        domInsertBefore(parent, n, anchor, scheduler.ops);
      }
    }
  }

  return nextSlots;
}

// ── Positional reconciliation (generator + sync wrapper) ────────────────────

/**
 * Generator version of `reconcileSlots`. Yields between processing each
 * child, allowing the scheduler to check time deadlines in async mode.
 *
 * In sync mode, the scheduler (or `runToCompletion`) drains the generator
 * immediately — identical to the non-generator behavior.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: positional diffing with keyed fallback
export function* reconcileSlotsGen(
  parent: HTMLElement | Node,
  prevSlots: Slot[],
  nextVNodes: Child[],
  beforeAnchor: Node | undefined,
): Generator<unknown, Slot[], unknown> {
  const ctxMap = yield* getContextMap();
  const scheduler = ctxMap.get(SchedulerCtx);
  // Flatten fragments before reconciling so each child has a stable index.
  const flatNext = flattenChildren(nextVNodes);

  // Use keyed reconciliation when any new child has a key prop.
  if (hasKeyedChildren(flatNext)) {
    return yield* reconcileKeyedSlotsGen(parent, prevSlots, flatNext, beforeAnchor);
  }

  const nextSlots: Slot[] = [];

  for (let i = 0; i < flatNext.length; i++) {
    const prevSlot = prevSlots[i];
    const { slot, node, replaced } = yield* reconcileOneGen(prevSlot, flatNext[i]);
    nextSlots.push(slot);

    if (!replaced) {
      yield;
      continue;
    }

    if (prevSlot) {
      // Grab the insertion reference BEFORE removing the old nodes.
      // For component slots, slot.node is the endMarker — its nextSibling
      // is the first node after this component's region.
      const insertRef = prevSlot.node.parentNode === parent ? prevSlot.node.nextSibling : null;
      unmountSlot(prevSlot);
      removeSlotNodes(parent, prevSlot, scheduler.ops);
      // Insert the new node at the old slot's position.
      domInsertBefore(parent, node, insertRef, scheduler.ops);
    } else if (beforeAnchor !== undefined) {
      // No previous slot at this position — insert before the anchor.
      domInsertBefore(parent, node, beforeAnchor, scheduler.ops);
    } else {
      // No previous slot and no anchor — use positional fallback.
      const ref = parent.childNodes[i] ?? null;
      if (ref) {
        domInsertBefore(parent, node, ref, scheduler.ops);
      } else {
        domAppendChild(parent, node, scheduler.ops);
      }
    }
    yield;
  }

  // Remove any extra old DOM nodes (the new list is shorter).
  for (let i = flatNext.length; i < prevSlots.length; i++) {
    // SAFETY: i is bounded by prevSlots.length
    const old = prevSlots[i] as Slot;
    unmountSlot(old);
    removeSlotNodes(parent, old, scheduler.ops);
  }

  return nextSlots;
}

// ── Single-slot reconciliation (generator) ──────────────────────────────────

/**
 * Reconcile a single child slot against a new VNode.
 *
 * Decision tree: null/false -> empty, string/number -> text,
 * $shown=false -> empty, Portal -> reconcilePortal,
 * component -> reconcileComponent, HTML element -> reconcileHTMLElement,
 * fallback -> buildNode.
 *
 * Returns `{ slot, node, replaced }` where `replaced` is true when the
 * DOM node changed and needs to be swapped in by the caller.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: VNode type dispatch with many match/replace branches
function* reconcileOneGen(
  prevSlot: Slot | undefined,
  nextChild: Child,
): Generator<unknown, { slot: Slot; node: Node; replaced: boolean }, unknown> {
  const ctxMap = yield* getContextMap();
  const scheduler = ctxMap.get(SchedulerCtx);

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Empty / null
  // Handles: null, undefined, false → empty text node placeholder.
  // ════════════════════════════════════════════════════════════════════════
  if (nextChild == null || nextChild === false) {
    if (prevSlot?.type === "empty") {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    const node = document.createTextNode("");
    return {
      slot: { type: "empty", node, props: {}, childSlots: [] },
      node,
      replaced: true,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Primitive (text / number)
  // Handles: string, number → TextNode.
  // ════════════════════════════════════════════════════════════════════════
  if (typeof nextChild === "string" || typeof nextChild === "number") {
    const text = String(nextChild);
    if (prevSlot?.type === "text" && prevSlot.node instanceof Text) {
      if (prevSlot.node.textContent !== text) {
        domSetText(prevSlot.node, text, scheduler.ops);
        prevSlot.props = { text };
      }
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    const node = document.createTextNode(text);
    return {
      slot: { type: "text", node, props: { text }, childSlots: [] },
      node,
      replaced: true,
    };
  }

  // SAFETY: All other Child types (null, false, string, number) are handled above.
  const vnode = nextChild as VNode;

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: $shown === false
  // When the $shown prop is explicitly false, unmount and render an empty
  // placeholder (same as null/false above).
  // ════════════════════════════════════════════════════════════════════════
  const allPropsForShown = propsWithChildren(vnode);
  if (allPropsForShown.$shown === false) {
    if (prevSlot?.type === "empty") {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    const node = document.createTextNode("");
    return {
      slot: { type: "empty", node, props: {}, childSlots: [] },
      node,
      replaced: true,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Portal
  // ════════════════════════════════════════════════════════════════════════
  if (vnode.type === Portal) {
    return yield* reconcilePortal(prevSlot, vnode);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Component
  // ════════════════════════════════════════════════════════════════════════
  if (isComponentNode(vnode)) {
    return yield* reconcileComponent(prevSlot, vnode, allPropsForShown);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: HTML element
  // ════════════════════════════════════════════════════════════════════════
  if (isElementNode(vnode)) {
    return yield* reconcileHTMLElement(prevSlot, vnode);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Fallback (Fragment or unknown)
  // Full rebuild via buildNode.
  // ════════════════════════════════════════════════════════════════════════
  const node = yield* driveWithContext(ctxMap, buildNode(nextChild));
  return {
    slot: { type: vnode.type, node, props: {}, childSlots: [] },
    node,
    replaced: true,
  };
}

// ── Extracted reconciliation handlers ─────────────────────────────────────

/**
 * Reconcile a component (or context Provider).
 *
 * Handles same-type updates (props diff, context propagation),
 * Provider in-place reconciliation, generator rerenders, and fresh mounts.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: component reconciliation with provider and rerender paths
function* reconcileComponent(
  prevSlot: Slot | undefined,
  vnode: VNode<Component>,
  allPropsForShown: InternalProps,
): Generator<unknown, { slot: Slot; node: Node; replaced: boolean }, unknown> {
  const ctxMap = yield* getContextMap();
  const allPropsRaw = allPropsForShown;
  // allProps: what the component sees (no $deferred, no $deps)
  const allProps = stripFrameworkDirectives(allPropsRaw);
  // slotProps: what Slot.props stores (keeps $deps for next comparison, strips $deferred)
  const slotProps = stripDeferred(allPropsRaw);
  const { type: component } = vnode;
  const newDeps = allPropsRaw.$deps;

  const childCtxMap = childContextMap(ctxMap, allPropsRaw);

  // ── Same component type at same position ──
  if (prevSlot?.type === vnode.type) {
    // $deps replaces the shallowEqual check when present on the new VNode.
    const propsUnchanged = newDeps
      ? !depsChanged(prevSlot.props.$deps, newDeps)
      : shallowEqual(prevSlot.props, allProps);
    if (propsUnchanged) {
      const { instance } = prevSlot;
      // When $deps says "unchanged", still update prevSlot.props so next
      // comparison uses the fresh deps array reference.
      if (newDeps) prevSlot.props = slotProps;
      if (instance) {
        // Update providedContexts from $context prop.
        const entries = contextEntries(allPropsRaw.$context);
        instance.providedContexts.clear();
        for (const entry of entries) {
          instance.providedContexts.add(entry.ctx);
        }

        // Check if any consumed context value differs from capturedCtx.
        let contextChanged = false;
        for (const ctx of instance.consumedContexts) {
          const currentVal = resolveCtx(childCtxMap, ctx);
          if (!Object.is(currentVal, resolveCtx(instance.capturedCtx, ctx))) {
            if (!hasStableContextSelectors(instance, ctx, currentVal)) {
              contextChanged = true;
              break;
            }
          }
        }

        if (contextChanged) {
          instance.capturedCtx = childCtxMap;
          void instance.scheduleRerender();
        } else {
          // Detect $context value changes that need propagation to descendants.
          const { capturedCtx: prevCtx } = instance;
          instance.capturedCtx = childCtxMap;
          for (const entry of entries) {
            const prevVal = resolveCtx(prevCtx, entry.ctx);
            if (!Object.is(prevVal, entry.value)) {
              propagateContextUpdate(entry.ctx, entry.value, instance.slots);
            }
          }
        }
      }
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }

    // Component with changed props → rerender in place
    if (prevSlot.instance) {
      prevSlot.instance.props = allProps;
      prevSlot.instance.capturedCtx = childCtxMap;
      const entries = contextEntries(allPropsRaw.$context);
      prevSlot.instance.providedContexts.clear();
      for (const entry of entries) {
        prevSlot.instance.providedContexts.add(entry.ctx);
      }
      void prevSlot.instance.scheduleRerender();
      prevSlot.props = slotProps;
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
  }

  // Mount fresh component
  const { fragment, instance } = yield* driveWithContext(
    childCtxMap,
    mountComponent(component, allProps),
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
    replaced: true,
  };
}

/**
 * Reconcile an HTML element. Same-tag: update props + reconcile children.
 * Different-tag: build fresh element.
 */
function* reconcileHTMLElement(
  prevSlot: Slot | undefined,
  vnode: VNode<string>,
): Generator<unknown, { slot: Slot; node: Node; replaced: boolean }, unknown> {
  const ctxMap = yield* getContextMap();
  const scheduler = ctxMap.get(SchedulerCtx);
  const childCtxMap = childContextMap(ctxMap, vnode.props);

  if (prevSlot?.type === vnode.type && prevSlot.node instanceof HTMLElement) {
    // Same tag → update props in place and reconcile children.
    // When $deps is present and unchanged, skip the entire subtree.
    const elDeps = vnode.props.$deps;
    if (elDeps && !depsChanged(prevSlot.props.$deps, elDeps)) {
      prevSlot.props = vnode.props;
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    const { props: prevProps } = prevSlot;
    domEnqueue(
      () =>
        updateProps(prevSlot.node as HTMLElement, prevProps, vnode.props, scheduler.delegationRoot),
      prevSlot.node,
      scheduler.ops,
    );
    prevSlot.props = vnode.props;
    prevSlot.childSlots = yield* driveWithContext(
      childCtxMap,
      reconcileSlotsGen(prevSlot.node, prevSlot.childSlots, vnode.children, undefined),
    );
    return { slot: prevSlot, node: prevSlot.node, replaced: false };
  }
  // Different tag → build fresh element
  const el = document.createElement(vnode.type);
  applyProps(el, vnode.props, scheduler.delegationRoot);
  const flatChildren = flattenChildren(vnode.children);
  const childSlots: Slot[] = [];
  for (const child of flatChildren) {
    const { slot: childSlot, node: childNode } = yield* driveWithContext(
      childCtxMap,
      reconcileOneGen(undefined, child),
    );
    childSlots.push(childSlot);
    el.appendChild(childNode);
  }
  return {
    slot: {
      type: vnode.type,
      node: el,
      props: vnode.props,
      childSlots,
    },
    node: el,
    replaced: true,
  };
}

// ── Portal reconciliation ─────────────────────────────────────────────────

/**
 * Reconcile a portal VNode.
 *
 * Portals render their children into an external DOM container while
 * maintaining component-tree context. A placeholder Comment node marks the
 * portal's position in the source tree.
 *
 * On update (same container): reconciles children in place inside the
 * portal container. On fresh mount (or container change): appends an
 * endMarker to the portal container and reconciles children into it.
 */
function* reconcilePortal(
  prevSlot: Slot | undefined,
  vnode: VNode,
): Generator<unknown, { slot: Slot; node: Node; replaced: boolean }, unknown> {
  const ctxMap = yield* getContextMap();
  const portalContainer = vnode.props["$portalContainer"] as Element;
  const scheduler = ctxMap.get(SchedulerCtx);

  // Same portal at same position, same container → reconcile children in place
  if (
    prevSlot?.type === Portal &&
    prevSlot.portalContainer === portalContainer &&
    prevSlot.portalEndMarker &&
    prevSlot.portalDelegationRoot
  ) {
    // Swap delegation root so event registration targets the portal container
    const { delegationRoot: prevDelegation } = scheduler;
    scheduler.delegationRoot = prevSlot.portalDelegationRoot;
    try {
      prevSlot.childSlots = yield* driveWithContext(
        ctxMap,
        reconcileSlotsGen(
          portalContainer,
          prevSlot.childSlots,
          vnode.children,
          prevSlot.portalEndMarker,
        ),
      );
    } finally {
      scheduler.delegationRoot = prevDelegation;
    }
    prevSlot.props = vnode.props;
    return { slot: prevSlot, node: prevSlot.node, replaced: false };
  }

  // Fresh mount (or container changed)
  const placeholder = document.createComment("portal");
  const endMarker = document.createComment("");
  portalContainer.appendChild(endMarker);

  const delegation = acquirePortalDelegation(portalContainer, scheduler);
  const { delegationRoot: prevDelegation } = scheduler;
  scheduler.delegationRoot = delegation;

  let childSlots: Slot[];
  try {
    childSlots = yield* driveWithContext(
      ctxMap,
      reconcileSlotsGen(portalContainer, [], vnode.children, endMarker),
    );
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
    replaced: true,
  };
}

/**
 * Returns `true` when every `useContext` hook call in `inst` that subscribes
 * to `ctx` has a selector whose selected deps are unchanged under `newValue`.
 *
 * **Called by:** the props-unchanged path in `reconcileComponent`.
 */
function hasStableContextSelectors(
  inst: ComponentInstance,
  ctx: Context,
  newValue: unknown,
): boolean {
  for (const s of inst.hookStates) {
    if (s === undefined || s.kind !== $USE_CONTEXT) continue;
    if (s.ctx !== ctx) continue;
    if (!s.selector) return false;
    const newDeps = s.selector(newValue);
    if (depsChanged(s.lastDeps, newDeps)) return false;
  }
  return true;
}
