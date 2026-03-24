/**
 * reconciler.ts — Positional reconciliation of DOM children against new VNodes.
 *
 * The reconciler is the core diffing engine. It compares the previous Slot
 * array against a new list of VNodes and applies the minimal DOM mutations:
 * - **Same type + same props** → skip (memoization).
 * - **Same type + changed props** → update in place (elements) or rerender (components).
 * - **Different type** → replace (unmount old, mount new).
 * - **Extra old slots** → remove.
 * - **Extra new VNodes** → append.
 *
 * Special handling for:
 * - `$patch` / `liveOnlyMode` — deferred updates during UI patches.
 * - Context Providers — in-place child reconciliation with `propagateContextUpdate`.
 * - `$shown` — conditional mount/unmount.
 * - `onlyPatchChanged` — skip rerender when only `$patch` prop changed.
 *
 * **No wrapper spans.** Components and Providers use end-marker
 * Comment nodes instead of wrapper `<span>` elements. The `beforeAnchor`
 * parameter on `reconcileSlots` controls where new nodes are inserted
 * when reconciling a component's output within a shared parent element.
 *
 * **Generator architecture.** The core functions (`reconcileSlotsGen`,
 * `reconcileOneGen`, `reconcileKeyedSlotsGen`) are generators that `yield`
 * at natural boundaries (between children). The synchronous wrappers
 * (`reconcileSlots`) drain them immediately. When wired into the scheduler
 * (async mode), yields allow the work loop to check time deadlines and
 * yield to the browser for event processing.
 */

import {
  _asProviderFn,
  _getProviderCtx,
  _instanceBatch,
  _resolveCtxValue,
  _withBatch,
  BatchContext,
  type Context,
  PriorityContext,
} from "../context";
import { depsChanged } from "../hooks";
import { $USE_CONTEXT } from "../hooks/descriptors";
import type { Child, Component, InternalProps, VNode } from "../jsx";
import { Portal } from "../jsx";
import { acquirePortalDelegation } from "./delegation";
import {
  childContextMap,
  flattenChildren,
  getPatchMode,
  isComponentNode,
  isElementNode,
  isVNode,
  mergedProps,
  onlyPatchChanged,
  shallowEqual,
  stripDeferred,
  stripFrameworkDirectives,
} from "./helpers";
import { propagateContextUpdate, unmountSlot } from "./hooks-runtime";
import { buildNode, mountComponent, mountContextProvider } from "./mount";
import {
  domAppendChild,
  domEnqueue,
  domInsertBefore,
  domRemoveChild,
  domSetText,
} from "./patch-queue";
import { applyProps, updateProps } from "./props";
import { _requireActiveCtx, runWithContext } from "./state";
import type { ComponentInstance, Slot } from "./types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Drain a generator synchronously, returning its final value. */
function runToCompletion<T>(gen: Generator<void, T, void>): T {
  let result = gen.next();
  while (!result.done) result = gen.next();
  return result.value;
}

/**
 * True when live-only mode is active and the current batch is `"default"`.
 *
 * In this state, only `$patch="live"` subtrees should be touched — default
 * subtrees are frozen until the patch commits.
 */
function isLiveOnlyDefault(ctxMap: ReadonlyMap<Context<unknown>, unknown>): boolean {
  return _requireActiveCtx().liveOnlyMode && _resolveCtxValue(ctxMap, BatchContext) !== "live";
}

/**
 * Recursively remove all DOM nodes owned by a slot from the given parent.
 *
 * For component slots, this removes all output nodes (tracked in
 * `componentInstance.slots`) and the slot's own node (the endMarker Comment).
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
function removeSlotNodes(parent: Node, slot: Slot): void {
  if (slot.portalContainer) {
    // Remove children from the portal container, not from the source parent.
    for (const child of slot.childSlots) {
      for (const node of collectSlotDOMNodes(child)) {
        domRemoveChild(slot.portalContainer, node);
      }
    }
    // Remove the endMarker from portal container.
    if (slot.portalEndMarker) {
      domRemoveChild(slot.portalContainer, slot.portalEndMarker);
    }
    // Remove the placeholder from the source tree.
    domRemoveChild(parent, slot.node);
    return;
  }
  for (const node of collectSlotDOMNodes(slot)) {
    domRemoveChild(parent, node);
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
  if (slot.componentInstance) {
    const nodes: Node[] = [];
    for (const child of slot.componentInstance.slots) {
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
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): Generator<void, Slot[], void> {
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
      const { slot, node, replaced } = yield* reconcileOneGen(matchedPrevSlot, nextChild, ctxMap);
      nextSlots.push(slot);
      if (replaced) {
        // Type changed — unmount old slot, track new node for insertion
        unmountSlot(matchedPrevSlot);
        removeSlotNodes(parent, matchedPrevSlot);
        freshNodes.set(i, node);
      }
    } else {
      const { slot, node, replaced } = yield* reconcileOneGen(undefined, nextChild, ctxMap);
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
      removeSlotNodes(parent, prevSlots[i] as Slot);
    }
  }

  // Reorder DOM: move/insert all slots' nodes into correct order
  const anchor = beforeAnchor ?? null;
  for (let i = 0; i < nextSlots.length; i++) {
    const freshNode = freshNodes.get(i);
    if (freshNode) {
      domInsertBefore(parent, freshNode, anchor);
    } else {
      for (const n of collectSlotDOMNodes(nextSlots[i] as Slot)) {
        domInsertBefore(parent, n, anchor);
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
function* reconcileSlotsGen(
  parent: HTMLElement | Node,
  prevSlots: Slot[],
  nextVNodes: Child[],
  beforeAnchor: Node | undefined,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): Generator<void, Slot[], void> {
  // Flatten fragments before reconciling so each child has a stable index.
  const flatNext = flattenChildren(nextVNodes);

  // Use keyed reconciliation when any new child has a key prop.
  if (hasKeyedChildren(flatNext)) {
    return yield* reconcileKeyedSlotsGen(parent, prevSlots, flatNext, beforeAnchor, ctxMap);
  }

  const nextSlots: Slot[] = [];

  for (let i = 0; i < flatNext.length; i++) {
    const prevSlot = prevSlots[i];
    const { slot, node, replaced } = yield* reconcileOneGen(prevSlot, flatNext[i], ctxMap);
    nextSlots.push(slot);

    if (replaced) {
      if (prevSlot) {
        // Grab the insertion reference BEFORE removing the old nodes.
        // For component slots, slot.node is the endMarker — its nextSibling
        // is the first node after this component's region.
        const insertRef = prevSlot.node.parentNode === parent ? prevSlot.node.nextSibling : null;
        unmountSlot(prevSlot);
        removeSlotNodes(parent, prevSlot);
        // Insert the new node at the old slot's position.
        domInsertBefore(parent, node, insertRef);
      } else if (beforeAnchor !== undefined) {
        // No previous slot at this position — insert before the anchor.
        domInsertBefore(parent, node, beforeAnchor);
      } else {
        // No previous slot and no anchor — use positional fallback.
        const ref = parent.childNodes[i] ?? null;
        if (ref) {
          domInsertBefore(parent, node, ref);
        } else {
          domAppendChild(parent, node);
        }
      }
    }
    // If not replaced, the existing node is already in the correct place.
    yield;
  }

  // Remove any extra old DOM nodes (the new list is shorter).
  for (let i = flatNext.length; i < prevSlots.length; i++) {
    // SAFETY: i is bounded by prevSlots.length
    const old = prevSlots[i] as Slot;
    unmountSlot(old);
    removeSlotNodes(parent, old);
  }

  return nextSlots;
}

/**
 * Reconcile the DOM children of `parent` against a new list of VNodes.
 *
 * Synchronous wrapper around `reconcileSlotsGen`. Drains the generator
 * immediately, preserving the current synchronous rendering behavior.
 *
 * **Called by:**
 * - `executeRerender` in `mount.ts` — reconciles the component's
 *   output against its previous slots.
 * - `resume` in `mount.ts` — same, after resuming a paused generator.
 * - `_flushPendingVNodes` in `patch.ts` — when committing deferred updates.
 *
 * @param parent        - The parent DOM element whose children to reconcile.
 * @param prevSlots     - The previous Slot array (from the last render).
 * @param nextVNodes    - The new VNode children to reconcile against.
 * @param beforeAnchor  - Optional anchor node. When provided, new nodes that
 *   don't have a previous slot are inserted before this anchor instead of
 *   using `parent.childNodes[i]`. Used by components and Providers
 *   whose output nodes share a parent with sibling slots.
 * @returns The updated Slot array (replaces `prevSlots`).
 */
export function reconcileSlots(
  parent: HTMLElement | Node,
  prevSlots: Slot[],
  nextVNodes: Child[],
  beforeAnchor: Node | undefined,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): Slot[] {
  return runToCompletion(reconcileSlotsGen(parent, prevSlots, nextVNodes, beforeAnchor, ctxMap));
}

// ── Single-slot reconciliation (generator) ──────────────────────────────────

/**
 * Reconcile a single child slot against a new VNode.
 *
 * This function implements the full decision tree for one position:
 *
 * ```
 * nextChild is null/false?
 *   └─ liveOnlyMode guard → skip or replace with empty
 *
 * nextChild is string/number?
 *   └─ same type (text) → update textContent
 *   └─ different → replace with new TextNode
 *
 * nextChild.$shown === false?
 *   └─ replace with empty placeholder
 *
 * nextChild is component?
 *   └─ same type at same position?
 *     └─ props unchanged (or only $patch changed)?
 *       └─ check consumed contexts → rerender if changed
 *       └─ $patch-only → forward $patch, rerender only if usePatchContext consumed
 *     └─ liveOnlyMode → skip non-live components
 *     └─ Context Provider → reconcile children in place
 *     └─ Component → rerender in place (preserve hook state)
 *   └─ different type → mount fresh component
 *
 * nextChild is HTML element?
 *   └─ same tag → updateProps + reconcile children
 *   └─ different tag → build fresh element
 *
 * Fallback → buildNode (full rebuild)
 * ```
 *
 * **Called by:** `reconcileSlotsGen` — once per position in the child list.
 *
 * @param prevSlot  - The previous Slot at this position, or `undefined` if new.
 * @param nextChild - The new VNode (or primitive/null) for this position.
 * @returns `{ slot, node, replaced }`:
 *   - `slot` — the updated (or new) Slot object.
 *   - `node` — the real DOM node for this slot (or a DocumentFragment for
 *     freshly-mounted components / Providers).
 *   - `replaced` — true if the DOM node changed and needs to be swapped in by the caller.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: VNode type dispatch with many match/replace branches
function* reconcileOneGen(
  prevSlot: Slot | undefined,
  nextChild: Child,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): Generator<void, { slot: Slot; node: Node; replaced: boolean }, void> {
  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Empty / null
  // Handles: null, undefined, false → empty text node placeholder.
  // ════════════════════════════════════════════════════════════════════════
  if (nextChild == null || nextChild === false) {
    // In live-only mode, skip removal unless we're in a live context OR the
    // existing slot is a $patch="live" component (it knows it's live).
    if (_requireActiveCtx().liveOnlyMode && prevSlot) {
      const prevIsLive = prevSlot.componentInstance
        ? (getPatchMode(prevSlot.componentInstance.props) ??
            _instanceBatch(prevSlot.componentInstance.capturedCtx)) === "live"
        : false;
      if (_resolveCtxValue(ctxMap, BatchContext) !== "live" && !prevIsLive) {
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }
    }
    // Already empty → reuse.
    if (prevSlot?.type === "empty") {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    // Different type was here before → replace with empty placeholder.
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
      // Same type (text) → update content in place.
      // In live-only mode, only update when the current batch is live.
      if (!isLiveOnlyDefault(ctxMap) && prevSlot.node.textContent !== text) {
        domSetText(prevSlot.node, text);
        prevSlot.props = { text };
      }
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    // In live-only default mode, don't insert new text nodes.
    if (isLiveOnlyDefault(ctxMap) && prevSlot) {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    // Different type was here → replace with new TextNode.
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
  const allPropsForShown = mergedProps(vnode);
  if (allPropsForShown.$shown === false) {
    // In live-only mode, only hide when the effective batch is live.
    if (_requireActiveCtx().liveOnlyMode) {
      const effectiveBatch =
        getPatchMode(allPropsForShown) ?? _resolveCtxValue(ctxMap, BatchContext);
      if (effectiveBatch !== "live" && prevSlot) {
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }
    }
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
    return yield* reconcilePortal(prevSlot, vnode, ctxMap);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Component
  // ════════════════════════════════════════════════════════════════════════
  if (isComponentNode(vnode)) {
    return yield* reconcileComponent(prevSlot, vnode, allPropsForShown, ctxMap);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: HTML element
  // ════════════════════════════════════════════════════════════════════════
  if (isElementNode(vnode)) {
    return yield* reconcileHTMLElement(prevSlot, vnode, ctxMap);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Fallback (Fragment or unknown)
  // Full rebuild via buildNode.
  // ════════════════════════════════════════════════════════════════════════
  const node = runWithContext(ctxMap, buildNode(nextChild));
  return {
    slot: { type: (vnode as VNode).type, node, props: {}, childSlots: [] },
    node,
    replaced: true,
  };
}

// ── Extracted reconciliation handlers ─────────────────────────────────────

/**
 * Reconcile a component (or context Provider).
 *
 * Handles same-type updates (props diff, context propagation, live-only skip),
 * Provider in-place reconciliation, generator rerenders, and fresh mounts.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: component reconciliation with provider and rerender paths
function* reconcileComponent(
  prevSlot: Slot | undefined,
  vnode: VNode<Component>,
  allPropsForShown: InternalProps,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): Generator<void, { slot: Slot; node: Node; replaced: boolean }, void> {
  const allPropsRaw = allPropsForShown;
  // allProps: what the component sees (no $deferred, no $deps)
  const allProps = stripFrameworkDirectives(allPropsRaw);
  // slotProps: what Slot.props stores (keeps $deps for next comparison, strips $deferred)
  const slotProps = stripDeferred(allPropsRaw);
  const component = vnode.type;
  const providerCtx = _getProviderCtx(component);
  const newDeps = allPropsRaw.$deps;

  const childCtxMap = childContextMap(ctxMap, allPropsRaw);

  const currentBatch = _resolveCtxValue(childCtxMap, BatchContext);

  // ── Same component type at same position ──
  if (prevSlot?.type === vnode.type) {
    // $deps replaces the shallowEqual check when present on the new VNode.
    const propsUnchanged = newDeps
      ? !depsChanged(prevSlot.props.$deps, newDeps)
      : shallowEqual(prevSlot.props, allProps);
    const patchOnly = !propsUnchanged && !newDeps && onlyPatchChanged(prevSlot.props, allProps);
    if (propsUnchanged || patchOnly) {
      const inst = prevSlot.componentInstance;
      // When $deps says "unchanged", still update prevSlot.props so next
      // comparison uses the fresh deps array reference.
      if (newDeps) prevSlot.props = slotProps;
      if (patchOnly && inst) {
        // Forward the new $patch value so shouldDefer reads it correctly.
        inst.props["$patch"] = allProps["$patch"];
        if (inst.consumedContexts.has(BatchContext)) {
          prevSlot.props = slotProps;
          inst.capturedCtx = _withBatch(inst.capturedCtx, currentBatch);
          inst.rerender();
          return { slot: prevSlot, node: prevSlot.node, replaced: false };
        }
      }
      if (patchOnly) {
        prevSlot.props = slotProps;
      }
      if (inst) {
        // Check if any consumed context value differs from capturedCtx.
        let contextChanged = false;
        for (const ctx of inst.consumedContexts) {
          const currentVal = _resolveCtxValue(childCtxMap, ctx);
          if (!Object.is(currentVal, _resolveCtxValue(inst.capturedCtx, ctx))) {
            if (!_hasStableContextSelectors(inst, ctx, currentVal)) {
              contextChanged = true;
              break;
            }
          }
        }

        if (contextChanged) {
          inst.capturedCtx = childCtxMap;
          inst.priority = _resolveCtxValue(childCtxMap, PriorityContext);
          inst.rerender();
        } else {
          inst.capturedCtx = _withBatch(inst.capturedCtx, currentBatch);
        }
      }
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }

    // Live-only mode: skip non-live components
    if (_requireActiveCtx().liveOnlyMode) {
      const effectiveBatch = getPatchMode(allProps) ?? currentBatch;
      if (effectiveBatch !== "live") {
        if (prevSlot.componentInstance) {
          prevSlot.componentInstance.capturedCtx = _withBatch(
            prevSlot.componentInstance.capturedCtx,
            currentBatch,
          );
          prevSlot.componentInstance.props["$patch"] = allProps["$patch"];
        }
        if (!providerCtx) {
          const hasContentChange = Object.keys({ ...prevSlot.props, ...allProps }).some(
            (k) => k !== "$patch" && k !== "$shown" && !Object.is(prevSlot.props[k], allProps[k]),
          );
          if (!hasContentChange) prevSlot.props = slotProps;
        }
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }
    }

    // Context Provider: reconcile children in place
    if (providerCtx) {
      const newCtxMap = new Map(childCtxMap);
      newCtxMap.set(providerCtx, allProps["value"]);
      if (!Object.is(prevSlot.props["value"], allProps["value"])) {
        propagateContextUpdate(providerCtx, allProps["value"], prevSlot.childSlots);
      }
      const childVNode = _asProviderFn(component)(allProps);
      if (childVNode != null) {
        prevSlot.childSlots = yield* reconcileSlotsGen(
          prevSlot.node.parentNode as HTMLElement,
          prevSlot.childSlots,
          [childVNode],
          prevSlot.node,
          newCtxMap,
        );
      }
      prevSlot.props = slotProps;
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }

    // Component with changed props → rerender in place
    if (prevSlot.componentInstance) {
      prevSlot.componentInstance.props = allProps;
      prevSlot.componentInstance.capturedCtx = _withBatch(
        prevSlot.componentInstance.capturedCtx,
        currentBatch,
      );
      prevSlot.componentInstance.rerender();
      prevSlot.props = slotProps;
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
  }

  // Live-only mode: structural changes (type mismatch / no prevSlot)
  if (_requireActiveCtx().liveOnlyMode && prevSlot?.type !== vnode.type) {
    const effectiveBatch = getPatchMode(allProps) ?? currentBatch;
    if (effectiveBatch !== "live") {
      if (prevSlot) return { slot: prevSlot, node: prevSlot.node, replaced: false };
      const node = document.createTextNode("");
      return {
        slot: { type: "empty", node, props: {}, childSlots: [] },
        node,
        replaced: true,
      };
    }
  }

  // Mount fresh component
  if (providerCtx) {
    const { fragment, endMarker, childSlots } = mountContextProvider(
      component,
      allProps,
      providerCtx,
      childCtxMap,
    );
    return {
      slot: {
        type: vnode.type,
        node: endMarker,
        props: slotProps,
        childSlots,
      },
      node: fragment,
      replaced: true,
    };
  }
  const { fragment, componentInstance } = mountComponent(component, allProps, childCtxMap);
  return {
    slot: {
      type: vnode.type,
      node: componentInstance.endMarker,
      props: slotProps,
      childSlots: [],
      componentInstance,
    },
    node: fragment,
    replaced: true,
  };
}

/**
 * Reconcile an HTML element (string tag name like 'div', 'span').
 *
 * Handles same-tag prop updates + child reconciliation, and different-tag
 * fresh element creation.
 */
function* reconcileHTMLElement(
  prevSlot: Slot | undefined,
  vnode: VNode<string>,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): Generator<void, { slot: Slot; node: Node; replaced: boolean }, void> {
  const childCtxMap = childContextMap(ctxMap, vnode.props);

  if (prevSlot?.type === vnode.type && prevSlot.node instanceof HTMLElement) {
    // Same tag → update props in place and reconcile children.
    // When $deps is present and unchanged, skip the entire subtree.
    const elDeps = vnode.props.$deps;
    if (elDeps && !depsChanged(prevSlot.props.$deps, elDeps)) {
      prevSlot.props = vnode.props;
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    if (!isLiveOnlyDefault(childCtxMap)) {
      const prevProps = prevSlot.props;
      domEnqueue(
        () => updateProps(prevSlot.node as HTMLElement, prevProps, vnode.props),
        prevSlot.node,
      );
    }
    prevSlot.props = vnode.props;
    prevSlot.childSlots = yield* reconcileSlotsGen(
      prevSlot.node,
      prevSlot.childSlots,
      vnode.children,
      undefined,
      childCtxMap,
    );
    return { slot: prevSlot, node: prevSlot.node, replaced: false };
  }
  // Different tag → build fresh element
  if (isLiveOnlyDefault(childCtxMap)) {
    if (prevSlot) return { slot: prevSlot, node: prevSlot.node, replaced: false };
    const empty = document.createTextNode("");
    return {
      slot: { type: "empty", node: empty, props: {}, childSlots: [] },
      node: empty,
      replaced: true,
    };
  }
  const el = document.createElement(vnode.type);
  applyProps(el, vnode.props);
  const flatChildren = flattenChildren(vnode.children);
  const childSlots: Slot[] = [];
  const prevLiveOnly = _requireActiveCtx().liveOnlyMode;
  _requireActiveCtx().liveOnlyMode = false;
  for (const child of flatChildren) {
    const { slot: childSlot, node: childNode } = yield* reconcileOneGen(
      undefined,
      child,
      childCtxMap,
    );
    childSlots.push(childSlot);
    el.appendChild(childNode);
  }
  _requireActiveCtx().liveOnlyMode = prevLiveOnly;
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
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): Generator<void, { slot: Slot; node: Node; replaced: boolean }, void> {
  const portalContainer = vnode.props["$portalContainer"] as Element;
  const rctx = _requireActiveCtx();

  // Same portal at same position, same container → reconcile children in place
  if (
    prevSlot?.type === Portal &&
    prevSlot.portalContainer === portalContainer &&
    prevSlot.portalEndMarker &&
    prevSlot.portalDelegationRoot
  ) {
    // Swap delegation root so event registration targets the portal container
    const prevDelegation = rctx.delegationRoot;
    rctx.delegationRoot = prevSlot.portalDelegationRoot;
    try {
      prevSlot.childSlots = yield* reconcileSlotsGen(
        portalContainer,
        prevSlot.childSlots,
        vnode.children,
        prevSlot.portalEndMarker,
        ctxMap,
      );
    } finally {
      rctx.delegationRoot = prevDelegation;
    }
    prevSlot.props = vnode.props;
    return { slot: prevSlot, node: prevSlot.node, replaced: false };
  }

  // Fresh mount (or container changed)
  const placeholder = document.createComment("portal");
  const endMarker = document.createComment("");
  portalContainer.appendChild(endMarker);

  const delegation = acquirePortalDelegation(portalContainer, rctx);
  const prevDelegation = rctx.delegationRoot;
  rctx.delegationRoot = delegation;

  let childSlots: Slot[];
  const prevLiveOnly = rctx.liveOnlyMode;
  rctx.liveOnlyMode = false;
  try {
    childSlots = yield* reconcileSlotsGen(portalContainer, [], vnode.children, endMarker, ctxMap);
  } finally {
    rctx.delegationRoot = prevDelegation;
    rctx.liveOnlyMode = prevLiveOnly;
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
function _hasStableContextSelectors(
  inst: ComponentInstance,
  ctx: Context<unknown>,
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
