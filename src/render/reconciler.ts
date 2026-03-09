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
 * **No wrapper spans.** Generator components and Providers use end-marker
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
  _batchCtx,
  _getCtxMap,
  _getCurrentBatch,
  _getCurrentPriority,
  _getProviderCtx,
  _instanceBatch,
  _resolveCtxValue,
  _setCtxMap,
  _withBatch,
  _withPriority,
  type Context,
} from "../context";
import { depsChanged } from "../hooks";
import type { AnyComponentFn, Child, PlainComponentFn, VNode } from "../jsx";
import {
  flattenChildren,
  getPatchMode,
  isGeneratorFn,
  isShown,
  isVNode,
  mergedProps,
  onlyPatchChanged,
  shallowEqual,
  stripDeferred,
} from "./helpers";
import { propagateContextUpdate, unmountSlot } from "./hooks-runtime";
import {
  buildNode,
  mountContextProvider,
  mountGeneratorComponent,
  mountPlainComponent,
} from "./mount";
import {
  domAppendChild,
  domEnqueue,
  domInsertBefore,
  domRemoveChild,
  domSetText,
} from "./patch-queue";
import { applyProps, updateProps } from "./props";
import { renderState } from "./state";
import type { GenInstance, Slot } from "./types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Drain a generator synchronously, returning its final value. */
function runToCompletion<T>(gen: Generator<void, T, void>): T {
  let result = gen.next();
  while (!result.done) result = gen.next();
  return result.value;
}

/**
 * Recursively remove all DOM nodes owned by a slot from the given parent.
 *
 * For generator component slots, this removes all output nodes (tracked in
 * `genInstance.slots`) and the slot's own node (the endMarker Comment).
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
  return child.props["$key"] as string | undefined;
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
 * For generator components: all output slot nodes (recursively) + endMarker.
 * For Providers: all child slot nodes (recursively) + endMarker.
 * For HTML elements, text, empty, plain components: just the single node.
 */
function collectSlotDOMNodes(slot: Slot): Node[] {
  if (slot.genInstance) {
    const nodes: Node[] = [];
    for (const child of slot.genInstance.slots) {
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
function* reconcileKeyedSlotsGen(
  parent: HTMLElement | Node,
  prevSlots: Slot[],
  flatNext: Child[],
  beforeAnchor?: Node,
): Generator<void, Slot[], void> {
  // Build key → prevIndex map for keyed prev slots,
  // and collect non-keyed prev slot indices for positional matching.
  const prevKeyMap = new Map<string | number, number>();
  const nonKeyedPrevIndices: number[] = [];
  for (let i = 0; i < prevSlots.length; i++) {
    const key = prevSlots[i]!.props["$key"] as string | undefined;
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
    const nextChild = flatNext[i]!;
    const nextKey = getChildKey(nextChild);

    let matchedPrevSlot: Slot | null = null;

    if (nextKey !== undefined && prevKeyMap.has(nextKey)) {
      // Keyed match
      const prevIndex = prevKeyMap.get(nextKey)!;
      if (!usedPrevIndices.has(prevIndex)) {
        matchedPrevSlot = prevSlots[prevIndex] ?? null;
        usedPrevIndices.add(prevIndex);
      }
    } else if (nextKey === undefined) {
      // Non-keyed: match positionally against non-keyed prev slots
      while (nonKeyedCursor < nonKeyedPrevIndices.length) {
        const prevIndex = nonKeyedPrevIndices[nonKeyedCursor++]!;
        if (!usedPrevIndices.has(prevIndex)) {
          matchedPrevSlot = prevSlots[prevIndex] ?? null;
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
        removeSlotNodes(parent, matchedPrevSlot);
        freshNodes.set(i, node);
      }
    } else {
      const { slot, node, replaced } = yield* reconcileOneGen(null, nextChild);
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
      unmountSlot(prevSlots[i]!);
      removeSlotNodes(parent, prevSlots[i]!);
    }
  }

  // Reorder DOM: move/insert all slots' nodes into correct order
  const anchor = beforeAnchor ?? null;
  for (let i = 0; i < nextSlots.length; i++) {
    const freshNode = freshNodes.get(i);
    if (freshNode) {
      domInsertBefore(parent, freshNode, anchor);
    } else {
      for (const n of collectSlotDOMNodes(nextSlots[i]!)) {
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
export function* reconcileSlotsGen(
  parent: HTMLElement | Node,
  prevSlots: Slot[],
  nextVNodes: Child[],
  beforeAnchor?: Node,
): Generator<void, Slot[], void> {
  // Flatten fragments before reconciling so each child has a stable index.
  const flatNext = flattenChildren(nextVNodes);

  // Use keyed reconciliation when any new child has a key prop.
  if (hasKeyedChildren(flatNext)) {
    return yield* reconcileKeyedSlotsGen(parent, prevSlots, flatNext, beforeAnchor);
  }

  const nextSlots: Slot[] = [];

  for (let i = 0; i < flatNext.length; i++) {
    const prevSlot = prevSlots[i] ?? null;
    const { slot, node, replaced } = yield* reconcileOneGen(prevSlot, flatNext[i]);
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
    const old = prevSlots[i]!;
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
 * - `executeRerender` in `mount.ts` — reconciles the generator component's
 *   output against its previous slots.
 * - `resume` in `mount.ts` — same, after resuming a paused generator.
 * - `_flushPendingVNodes` in `patch.ts` — when committing deferred updates.
 *
 * @param parent        - The parent DOM element whose children to reconcile.
 * @param prevSlots     - The previous Slot array (from the last render).
 * @param nextVNodes    - The new VNode children to reconcile against.
 * @param beforeAnchor  - Optional anchor node. When provided, new nodes that
 *   don't have a previous slot are inserted before this anchor instead of
 *   using `parent.childNodes[i]`. Used by generator components and Providers
 *   whose output nodes share a parent with sibling slots.
 * @returns The updated Slot array (replaces `prevSlots`).
 */
export function reconcileSlots(
  parent: HTMLElement | Node,
  prevSlots: Slot[],
  nextVNodes: Child[],
  beforeAnchor?: Node,
): Slot[] {
  return runToCompletion(reconcileSlotsGen(parent, prevSlots, nextVNodes, beforeAnchor));
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
 * nextChild is function component?
 *   └─ same type at same position?
 *     └─ props unchanged (or only $patch changed)?
 *       └─ check consumed contexts → rerender if changed
 *       └─ $patch-only → forward $patch, rerender only if usePatchContext consumed
 *     └─ liveOnlyMode → skip non-live components
 *     └─ Context Provider → reconcile children in place
 *     └─ Generator component → rerender in place (preserve hook state)
 *     └─ Plain component → fall through to fresh mount
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
 * @param prevSlot  - The previous Slot at this position, or `null` if new.
 * @param nextChild - The new VNode (or primitive/null) for this position.
 * @returns `{ slot, node, replaced }`:
 *   - `slot` — the updated (or new) Slot object.
 *   - `node` — the real DOM node for this slot (or a DocumentFragment for
 *     freshly-mounted generator components / Providers).
 *   - `replaced` — true if the DOM node changed and needs to be swapped in by the caller.
 */
function* reconcileOneGen(
  prevSlot: Slot | null,
  nextChild: Child,
): Generator<void, { slot: Slot; node: Node; replaced: boolean }, void> {
  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Empty / null
  // Handles: null, undefined, false → empty text node placeholder.
  // ════════════════════════════════════════════════════════════════════════
  if (nextChild == null || nextChild === false) {
    // In live-only mode, skip removal unless we're in a live context OR the
    // existing slot is a $patch="live" component (it knows it's live).
    if (renderState.liveOnlyMode && prevSlot) {
      const prevIsLive = prevSlot.genInstance
        ? (getPatchMode(prevSlot.genInstance.props) ??
            _instanceBatch(prevSlot.genInstance.capturedCtx)) === "live"
        : false;
      if (_getCurrentBatch() !== "live" && !prevIsLive) {
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
      slot: { type: "empty", node, props: {}, childSlots: [], genInstance: null },
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
      if (
        (!renderState.liveOnlyMode || _getCurrentBatch() === "live") &&
        prevSlot.node.textContent !== text
      ) {
        domSetText(prevSlot.node, text);
        prevSlot.props = { text };
      }
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    // In live-only default mode, don't insert new text nodes.
    if (renderState.liveOnlyMode && _getCurrentBatch() !== "live" && prevSlot) {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    // Different type was here → replace with new TextNode.
    const node = document.createTextNode(text);
    return {
      slot: { type: "text", node, props: { text }, childSlots: [], genInstance: null },
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
  if (!isShown(allPropsForShown)) {
    // In live-only mode, only hide when the effective batch is live.
    if (renderState.liveOnlyMode) {
      const effectiveBatch = getPatchMode(allPropsForShown) ?? _getCurrentBatch();
      if (effectiveBatch !== "live" && prevSlot) {
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }
    }
    if (prevSlot?.type === "empty") {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    const node = document.createTextNode("");
    return {
      slot: { type: "empty", node, props: {}, childSlots: [], genInstance: null },
      node,
      replaced: true,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Function component
  // Handles generator components, plain components, and context Providers.
  // ════════════════════════════════════════════════════════════════════════
  if (typeof vnode.type === "function") {
    /** The merged props (including children if any), with $deferred stripped. */
    const allPropsRaw = allPropsForShown;
    const allProps = stripDeferred(allPropsRaw);
    /** The component function reference. */
    const fn = vnode.type as AnyComponentFn;
    /** Non-null if this function is a context Provider (created by createContext). */
    const providerCtx = _getProviderCtx(fn);

    // Propagate $deferred to the subtree via context.
    // Save and restore the context map so siblings are unaffected.
    const compDeferred = allPropsRaw["$deferred"] as boolean | undefined; // SAFETY: $deferred is always boolean | undefined
    const prevCtxComp = _getCtxMap();
    if (compDeferred) _setCtxMap(_withPriority(prevCtxComp, _getCurrentPriority() + 1));
    try {
      // ── Same component type at same position ──
      if (prevSlot?.type === vnode.type) {
        // ┌─────────────────────────────────────────────────────────────────┐
        // │ Props unchanged / only $patch changed → skip rerender          │
        // └─────────────────────────────────────────────────────────────────┘
        const propsUnchanged = shallowEqual(prevSlot.props, allProps);
        const patchOnly = !propsUnchanged && onlyPatchChanged(prevSlot.props, allProps);
        if (propsUnchanged || patchOnly) {
          const inst = prevSlot.genInstance;
          if (patchOnly && inst) {
            // Forward the new $patch value so shouldDefer reads it correctly.
            inst.props["$patch"] = allProps["$patch"];
            if (inst.consumedContexts.has(_batchCtx as Context<unknown>)) {
              prevSlot.props = allProps;
              inst.capturedCtx = _withBatch(inst.capturedCtx, _getCurrentBatch());
              inst.rerender();
              return { slot: prevSlot, node: prevSlot.node, replaced: false };
            }
          }
          if (patchOnly) {
            prevSlot.props = allProps;
          }
          if (inst) {
            // Check if any consumed context value differs from capturedCtx.
            const currentCtxMap = _getCtxMap();
            let contextChanged = false;
            for (const ctx of inst.consumedContexts) {
              const currentVal = _resolveCtxValue(currentCtxMap, ctx);
              if (!Object.is(currentVal, _resolveCtxValue(inst.capturedCtx, ctx))) {
                if (!_hasStableContextSelectors(inst, ctx, currentVal)) {
                  contextChanged = true;
                  break;
                }
              }
            }

            if (contextChanged) {
              inst.capturedCtx = currentCtxMap;
              inst.rerender();
            } else {
              inst.capturedCtx = _withBatch(inst.capturedCtx, _getCurrentBatch());
            }
          }
          return { slot: prevSlot, node: prevSlot.node, replaced: false };
        }

        // ┌─────────────────────────────────────────────────────────────────┐
        // │ Live-only mode: skip non-live components                       │
        // └─────────────────────────────────────────────────────────────────┘
        if (renderState.liveOnlyMode) {
          const effectiveBatch = getPatchMode(allProps) ?? _getCurrentBatch();
          if (effectiveBatch !== "live") {
            if (prevSlot.genInstance) {
              prevSlot.genInstance.capturedCtx = _withBatch(
                prevSlot.genInstance.capturedCtx,
                _getCurrentBatch(),
              );
              prevSlot.genInstance.props["$patch"] = allProps["$patch"];
            }
            if (!providerCtx) {
              const hasContentChange = Object.keys({ ...prevSlot.props, ...allProps }).some(
                (k) =>
                  k !== "$patch" && k !== "$shown" && !Object.is(prevSlot.props[k], allProps[k]),
              );
              if (!hasContentChange) prevSlot.props = allProps;
            }
            return { slot: prevSlot, node: prevSlot.node, replaced: false };
          }
        }

        // ┌─────────────────────────────────────────────────────────────────┐
        // │ Context Provider: reconcile children in place                  │
        // └─────────────────────────────────────────────────────────────────┘
        if (providerCtx) {
          const prevCtxMap = _getCtxMap();
          const newCtxMap = new Map(prevCtxMap);
          newCtxMap.set(providerCtx as never, allProps["value"] as unknown);
          _setCtxMap(newCtxMap);
          try {
            if (!Object.is(prevSlot.props["value"], allProps["value"])) {
              propagateContextUpdate(providerCtx, allProps["value"], prevSlot.childSlots);
            }
            const childVNode = (fn as PlainComponentFn)(allProps);
            if (childVNode != null) {
              // Provider's endMarker is prevSlot.node; its children are
              // in the same parent, before the endMarker.
              prevSlot.childSlots = yield* reconcileSlotsGen(
                prevSlot.node.parentNode as HTMLElement,
                prevSlot.childSlots,
                [childVNode],
                prevSlot.node,
              );
            }
          } finally {
            _setCtxMap(prevCtxMap);
          }
          prevSlot.props = allProps;
          return { slot: prevSlot, node: prevSlot.node, replaced: false };
        }

        // ┌─────────────────────────────────────────────────────────────────┐
        // │ Generator component with changed props → rerender in place     │
        // └─────────────────────────────────────────────────────────────────┘
        if (prevSlot.genInstance) {
          prevSlot.genInstance.props = allProps;
          prevSlot.genInstance.capturedCtx = _withBatch(
            prevSlot.genInstance.capturedCtx,
            _getCurrentBatch(),
          );
          prevSlot.genInstance.rerender();
          prevSlot.props = allProps;
          return { slot: prevSlot, node: prevSlot.node, replaced: false };
        }

        // Plain function component → fall through to fresh mount below.
      }

      // ┌───────────────────────────────────────────────────────────────────┐
      // │ Live-only mode: structural changes (type mismatch / no prevSlot) │
      // └───────────────────────────────────────────────────────────────────┘
      if (renderState.liveOnlyMode && prevSlot?.type !== vnode.type) {
        const effectiveBatch = getPatchMode(allProps) ?? _getCurrentBatch();
        if (effectiveBatch !== "live") {
          if (prevSlot) return { slot: prevSlot, node: prevSlot.node, replaced: false };
          const node = document.createTextNode("");
          return {
            slot: { type: "empty", node, props: {}, childSlots: [], genInstance: null },
            node,
            replaced: true,
          };
        }
      }

      // ┌───────────────────────────────────────────────────────────────────┐
      // │ Mount fresh component (new type or plain component remount)      │
      // └───────────────────────────────────────────────────────────────────┘
      if (providerCtx) {
        const { fragment, endMarker, childSlots } = mountContextProvider(
          fn as PlainComponentFn,
          allProps,
          providerCtx,
        );
        return {
          slot: {
            type: vnode.type,
            node: endMarker,
            props: allProps,
            childSlots,
            genInstance: null,
          },
          node: fragment,
          replaced: true,
        };
      }
      if (isGeneratorFn(fn)) {
        const { fragment, genInstance } = mountGeneratorComponent(fn, allProps);
        return {
          slot: {
            type: vnode.type,
            node: genInstance.endMarker,
            props: allProps,
            childSlots: [],
            genInstance,
          },
          node: fragment,
          replaced: true,
        };
      }
      // Plain component
      const node = mountPlainComponent(fn as PlainComponentFn, allProps);
      return {
        slot: { type: vnode.type, node, props: allProps, childSlots: [], genInstance: null },
        node,
        replaced: true,
      };
    } finally {
      // Restore context map after $deferred propagation so siblings are unaffected.
      if (compDeferred) _setCtxMap(prevCtxComp);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: HTML element
  // Handles: string tag names (e.g. 'div', 'span').
  // ════════════════════════════════════════════════════════════════════════
  if (typeof vnode.type === "string") {
    // Propagate $patch and $deferred to children via the context map.
    // Save and restore the context map around child reconciliation.
    const elBatch = getPatchMode(vnode.props);
    const elDeferred = vnode.props["$deferred"] as boolean | undefined;
    const prevCtxEl = _getCtxMap();
    if (elBatch !== undefined) _setCtxMap(_withBatch(prevCtxEl, elBatch));
    if (elDeferred) _setCtxMap(_withPriority(_getCtxMap(), _getCurrentPriority() + 1));
    try {
      if (prevSlot?.type === vnode.type && prevSlot.node instanceof HTMLElement) {
        // ── Same tag → update props in place and reconcile children ──
        if (!renderState.liveOnlyMode || _getCurrentBatch() === "live") {
          const prevProps = prevSlot.props;
          domEnqueue(
            () => updateProps(prevSlot.node as HTMLElement, prevProps, vnode.props),
            prevSlot.node,
          );
          prevSlot.props = vnode.props;
        }
        prevSlot.childSlots = yield* reconcileSlotsGen(
          prevSlot.node,
          prevSlot.childSlots,
          vnode.children,
        );
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }
      // ── Different tag → build fresh element ──
      if (renderState.liveOnlyMode && _getCurrentBatch() !== "live") {
        if (prevSlot) return { slot: prevSlot, node: prevSlot.node, replaced: false };
        const empty = document.createTextNode("");
        return {
          slot: { type: "empty", node: empty, props: {}, childSlots: [], genInstance: null },
          node: empty,
          replaced: true,
        };
      }
      const el = document.createElement(vnode.type);
      applyProps(el, vnode.props);
      const flatChildren = flattenChildren(vnode.children);
      const childSlots: Slot[] = [];
      const prevLiveOnly = renderState.liveOnlyMode;
      renderState.liveOnlyMode = false;
      for (const child of flatChildren) {
        const { slot: childSlot, node: childNode } = yield* reconcileOneGen(null, child);
        childSlots.push(childSlot);
        el.appendChild(childNode);
      }
      renderState.liveOnlyMode = prevLiveOnly;
      return {
        slot: {
          type: vnode.type,
          node: el,
          props: vnode.props,
          childSlots,
          genInstance: null,
        },
        node: el,
        replaced: true,
      };
    } finally {
      _setCtxMap(prevCtxEl);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Fallback (Fragment or unknown)
  // Full rebuild via buildNode.
  // ════════════════════════════════════════════════════════════════════════
  const node = buildNode(nextChild);
  return {
    slot: { type: (vnode as VNode).type, node, props: {}, childSlots: [], genInstance: null },
    node,
    replaced: true,
  };
}

/**
 * Returns `true` when every `useContext` hook call in `inst` that subscribes
 * to `ctx` has a selector whose selected deps are unchanged under `newValue`.
 *
 * **Called by:** the props-unchanged path in `reconcileOne` above.
 */
function _hasStableContextSelectors(
  inst: GenInstance,
  ctx: Context<unknown>,
  newValue: unknown,
): boolean {
  let _foundAny = false;
  for (const s of inst.hookStates) {
    if (s === undefined || s.kind !== "context") continue;
    if (s.ctx !== ctx) continue;
    _foundAny = true;
    if (!s.selector) return false;
    const newDeps = s.selector(newValue);
    if (depsChanged(s.lastDeps, newDeps)) return false;
  }
  return true;
}
