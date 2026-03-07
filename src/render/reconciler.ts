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
 */

import { type VNode, type Child, type AnyComponentFn, type PlainComponentFn } from '../jsx';
import {
  _getCtxMap,
  _setCtxMap,
  _getProviderCtx,
  _resolveCtxValue,
  _getCurrentBatch,
  _instanceBatch,
  _withBatch,
  _batchCtx,
  type Context,
} from '../context';
import { depsChanged } from '../hooks';
import { type Slot, type GenInstance } from './types';
import { renderState } from './state';
import { applyProps, updateProps } from './props';
import {
  isGeneratorFn,
  shallowEqual,
  onlyPatchChanged,
  flattenChildren,
  mergedProps,
  isShown,
} from './helpers';
import { unmountSlot, propagateContextUpdate, type UseContextState } from './hooks-runtime';
import {
  mountGeneratorComponent,
  mountContextProvider,
  mountPlainComponent,
  buildVNodeList,
  buildNode,
} from './mount';

/**
 * Reconcile the DOM children of `parent` against a new list of VNodes.
 *
 * Children are matched by **position** (index). For each position, calls
 * `reconcileOne` to diff the old Slot against the new VNode.
 *
 * After processing all new VNodes, removes any extra old slots (the new
 * list is shorter) by calling `unmountSlot` and removing the DOM node.
 *
 * **Called by:**
 * - `executeRerender` in `mount.ts` — reconciles the generator component's
 *   output against its previous slots.
 * - `resume` in `mount.ts` — same, after resuming a paused generator.
 * - `reconcileOne` below — recursively, for HTML element children and
 *   context Provider children.
 * - `_flushPendingVNodes` in `patch.ts` — when committing deferred updates.
 *
 * @param parent    - The parent DOM element whose children to reconcile.
 * @param prevSlots - The previous Slot array (from the last render).
 * @param nextVNodes - The new VNode children to reconcile against.
 * @returns The updated Slot array (replaces `prevSlots`).
 */
export function reconcileSlots(
  parent: HTMLElement,
  prevSlots: Slot[],
  nextVNodes: Child[],
): Slot[] {
  // Flatten fragments before reconciling so each child has a stable index.
  const flatNext = flattenChildren(nextVNodes);
  const nextSlots: Slot[] = [];

  for (let i = 0; i < flatNext.length; i++) {
    const prevSlot = prevSlots[i] ?? null;
    const { slot, node, replaced } = reconcileOne(prevSlot, flatNext[i]);
    nextSlots.push(slot);

    if (replaced) {
      // The DOM node changed — swap it into the parent.
      if (prevSlot) unmountSlot(prevSlot);
      if (prevSlot && prevSlot.node.parentNode === parent) {
        parent.replaceChild(node, prevSlot.node);
      } else {
        // No previous node at this position — insert before the next sibling.
        const ref = parent.childNodes[i] ?? null;
        if (ref) {
          parent.insertBefore(node, ref);
        } else {
          parent.appendChild(node);
        }
      }
    }
    // If not replaced, the existing node is already in the correct place.
  }

  // Remove any extra old DOM nodes (the new list is shorter).
  for (let i = flatNext.length; i < prevSlots.length; i++) {
    const old = prevSlots[i];
    unmountSlot(old);
    if (old.node.parentNode === parent) {
      parent.removeChild(old.node);
    }
  }

  return nextSlots;
}

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
 * **Called by:** `reconcileSlots` above — once per position in the child list.
 *
 * @param prevSlot  - The previous Slot at this position, or `null` if new.
 * @param nextChild - The new VNode (or primitive/null) for this position.
 * @returns `{ slot, node, replaced }`:
 *   - `slot` — the updated (or new) Slot object.
 *   - `node` — the real DOM node for this slot.
 *   - `replaced` — true if the DOM node changed and needs to be swapped in by the caller.
 */
function reconcileOne(
  prevSlot: Slot | null,
  nextChild: Child,
): { slot: Slot; node: Node; replaced: boolean } {
  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Empty / null
  // Handles: null, undefined, false → empty text node placeholder.
  // ════════════════════════════════════════════════════════════════════════
  if (nextChild == null || nextChild === false) {
    // In live-only mode, skip removal unless we're in a live context OR the
    // existing slot is a $patch="live" component (it knows it's live).
    if (renderState.liveOnlyMode && prevSlot) {
      const prevIsLive = prevSlot.genInstance
        ? ((prevSlot.genInstance.props['$patch'] as 'live' | 'default' | undefined) ??
            _instanceBatch(prevSlot.genInstance.capturedCtx)) === 'live'
        : false;
      if (_getCurrentBatch() !== 'live' && !prevIsLive) {
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }
    }
    // Already empty → reuse.
    if (prevSlot?.type === 'empty') {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    // Different type was here before → replace with empty placeholder.
    const node = document.createTextNode('');
    return {
      slot: { type: 'empty', node, props: {}, childSlots: [], genInstance: null },
      node,
      replaced: true,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Primitive (text / number)
  // Handles: string, number → TextNode.
  // ════════════════════════════════════════════════════════════════════════
  if (typeof nextChild === 'string' || typeof nextChild === 'number') {
    const text = String(nextChild);
    if (prevSlot?.type === 'text' && prevSlot.node instanceof Text) {
      // Same type (text) → update content in place.
      // In live-only mode, only update when the current batch is live.
      if (
        (!renderState.liveOnlyMode || _getCurrentBatch() === 'live') &&
        prevSlot.node.textContent !== text
      ) {
        prevSlot.node.textContent = text;
        prevSlot.props = { text };
      }
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    // In live-only default mode, don't insert new text nodes.
    if (renderState.liveOnlyMode && _getCurrentBatch() !== 'live' && prevSlot) {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    // Different type was here → replace with new TextNode.
    const node = document.createTextNode(text);
    return {
      slot: { type: 'text', node, props: { text }, childSlots: [], genInstance: null },
      node,
      replaced: true,
    };
  }

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
      const effectiveBatch =
        (allPropsForShown['$patch'] as 'live' | 'default' | undefined) ?? _getCurrentBatch();
      if (effectiveBatch !== 'live' && prevSlot) {
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }
    }
    if (prevSlot?.type === 'empty') {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    const node = document.createTextNode('');
    return {
      slot: { type: 'empty', node, props: {}, childSlots: [], genInstance: null },
      node,
      replaced: true,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: Function component
  // Handles generator components, plain components, and context Providers.
  // ════════════════════════════════════════════════════════════════════════
  if (typeof vnode.type === 'function') {
    /** The merged props (including children if any). */
    const allProps = allPropsForShown;
    /** The component function reference. */
    const fn = vnode.type as AnyComponentFn;
    /** Non-null if this function is a context Provider (created by createContext). */
    const providerCtx = _getProviderCtx(fn);

    // ── Same component type at same position ──
    if (prevSlot?.type === vnode.type) {
      // ┌─────────────────────────────────────────────────────────────────┐
      // │ Props unchanged / only $patch changed → skip rerender          │
      // │                                                                │
      // │ If props are fully unchanged (shallowEqual), or only the       │
      // │ $patch prop differs (onlyPatchChanged), the component body     │
      // │ does NOT re-execute. Instead:                                  │
      // │ - Forward $patch to inst.props for shouldDefer checks.         │
      // │ - If the component consumes _batchCtx (usePatchContext),       │
      // │   rerender it (the effective batch changed).                   │
      // │ - Check all consumed contexts for changes — rerender if any    │
      // │   context value differs (and selectors are not stable).        │
      // │ - Otherwise just sync capturedCtx's inherited batch.           │
      // └─────────────────────────────────────────────────────────────────┘
      const propsUnchanged = shallowEqual(prevSlot.props, allProps);
      const patchOnly = !propsUnchanged && onlyPatchChanged(prevSlot.props, allProps);
      if (propsUnchanged || patchOnly) {
        const inst = prevSlot.genInstance;
        if (patchOnly && inst) {
          // Forward the new $patch value so shouldDefer reads it correctly.
          inst.props['$patch'] = allProps['$patch'];
          // The effective batch changed (own $patch). If the component
          // consumes usePatchContext (_batchCtx), it must rerender because
          // the context change detection below compares inherited contexts
          // only and won't detect the own-$patch change.
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
          // This must run BEFORE updating the inherited batch so that
          // usePatchContext consumers detect batch changes from ancestors.
          const currentCtxMap = _getCtxMap();
          let contextChanged = false;
          for (const ctx of inst.consumedContexts) {
            const currentVal = _resolveCtxValue(currentCtxMap, ctx);
            if (!Object.is(currentVal, _resolveCtxValue(inst.capturedCtx, ctx))) {
              // Check if all selectors for this context have stable deps.
              if (!_hasStableContextSelectors(inst, ctx, currentVal)) {
                contextChanged = true;
                break;
              }
            }
          }

          if (contextChanged) {
            // Update capturedCtx so rerender() uses the current context.
            inst.capturedCtx = currentCtxMap;
            inst.rerender();
          } else {
            // No consumed context changed — still sync the inherited batch
            // so future rerenders / shouldDefer checks see the right value.
            inst.capturedCtx = _withBatch(inst.capturedCtx, _getCurrentBatch());
          }
        }
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }

      // ┌─────────────────────────────────────────────────────────────────┐
      // │ Live-only mode: skip non-live components                       │
      // │                                                                │
      // │ During a deferred reconcile pass (liveOnlyMode=true), only     │
      // │ $patch="live" components proceed. All others are skipped —     │
      // │ their update will be applied when commitUIPatch runs.          │
      // │                                                                │
      // │ Special handling:                                              │
      // │ - Forward $patch to genInstance.props so shouldDefer reads it. │
      // │ - Forward meta-only prop changes ($patch, $shown) to prevent   │
      // │   spurious remounts at commit time.                            │
      // │ - Do NOT forward content prop changes — they must survive      │
      // │   to commit so shallowEqual detects the diff.                  │
      // └─────────────────────────────────────────────────────────────────┘
      if (renderState.liveOnlyMode) {
        const effectiveBatch =
          (allProps['$patch'] as 'live' | 'default' | undefined) ?? _getCurrentBatch();
        if (effectiveBatch !== 'live') {
          if (prevSlot.genInstance) {
            prevSlot.genInstance.capturedCtx = _withBatch(
              prevSlot.genInstance.capturedCtx,
              _getCurrentBatch(),
            );
            prevSlot.genInstance.props['$patch'] = allProps['$patch'];
          }
          if (!providerCtx) {
            const hasContentChange = Object.keys({ ...prevSlot.props, ...allProps }).some(
              (k) => k !== '$patch' && k !== '$shown' && !Object.is(prevSlot.props[k], allProps[k]),
            );
            if (!hasContentChange) prevSlot.props = allProps;
          }
          return { slot: prevSlot, node: prevSlot.node, replaced: false };
        }
      }

      // ┌─────────────────────────────────────────────────────────────────┐
      // │ Context Provider: reconcile children in place                  │
      // │                                                                │
      // │ Providers always reconcile children, regardless of whether     │
      // │ the value changed. When the value DID change, propagate the    │
      // │ update to all descendant generator instances first so their    │
      // │ capturedCtx stays current and consumers rerender immediately.  │
      // └─────────────────────────────────────────────────────────────────┘
      if (providerCtx) {
        const prevCtxMap = _getCtxMap();
        const newCtxMap = new Map(prevCtxMap);
        newCtxMap.set(providerCtx as never, allProps.value as unknown);
        _setCtxMap(newCtxMap);
        try {
          if (!Object.is(prevSlot.props['value'], allProps['value'])) {
            propagateContextUpdate(providerCtx, allProps.value, prevSlot.childSlots);
          }
          const childVNode = (fn as PlainComponentFn)(allProps);
          if (childVNode != null) {
            prevSlot.childSlots = reconcileSlots(
              prevSlot.node as HTMLElement,
              prevSlot.childSlots,
              [childVNode],
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
      // │                                                                │
      // │ The instance survives (hook state preserved). Only the         │
      // │ generator body re-executes with the new props.                 │
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
      // (Plain components have no instance to rerender in place.)
    }

    // ┌───────────────────────────────────────────────────────────────────┐
    // │ Live-only mode: structural changes (type mismatch / no prevSlot) │
    // │                                                                  │
    // │ Only proceed when the effective batch for the incoming component  │
    // │ is 'live'. Otherwise skip (keep prevSlot or create empty).       │
    // └───────────────────────────────────────────────────────────────────┘
    if (renderState.liveOnlyMode && prevSlot?.type !== vnode.type) {
      const effectiveBatch =
        (allProps['$patch'] as 'live' | 'default' | undefined) ?? _getCurrentBatch();
      if (effectiveBatch !== 'live') {
        if (prevSlot) return { slot: prevSlot, node: prevSlot.node, replaced: false };
        const node = document.createTextNode('');
        return {
          slot: { type: 'empty', node, props: {}, childSlots: [], genInstance: null },
          node,
          replaced: true,
        };
      }
      // effectiveBatch === 'live' → fall through and mount/replace immediately
    }

    // ┌───────────────────────────────────────────────────────────────────┐
    // │ Mount fresh component (new type or plain component remount)      │
    // └───────────────────────────────────────────────────────────────────┘
    if (providerCtx) {
      const { node, childSlots } = mountContextProvider(
        fn as PlainComponentFn,
        allProps,
        providerCtx,
      );
      return {
        slot: { type: vnode.type, node, props: allProps, childSlots, genInstance: null },
        node,
        replaced: true,
      };
    }
    let node: Node;
    if (isGeneratorFn(fn)) {
      node = mountGeneratorComponent(fn, allProps);
    } else {
      node = mountPlainComponent(fn as PlainComponentFn, allProps);
    }
    const genInstance =
      node instanceof HTMLElement ? (renderState.genInstanceMap.get(node) ?? null) : null;
    return {
      slot: { type: vnode.type, node, props: allProps, childSlots: [], genInstance },
      node,
      replaced: true,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION: HTML element
  // Handles: string tag names (e.g. 'div', 'span').
  // ════════════════════════════════════════════════════════════════════════
  if (typeof vnode.type === 'string') {
    // If the element has a $patch prop, propagate it to children via the
    // context map. Save and restore the context map around child reconciliation.
    const elBatch = vnode.props['$patch'] as 'live' | 'default' | undefined;
    const prevCtxEl = _getCtxMap();
    if (elBatch !== undefined) _setCtxMap(_withBatch(prevCtxEl, elBatch));
    try {
      if (prevSlot?.type === vnode.type && prevSlot.node instanceof HTMLElement) {
        // ── Same tag → update props in place and reconcile children ──
        // In live-only mode, skip own prop updates when context is frozen.
        if (!renderState.liveOnlyMode || _getCurrentBatch() === 'live') {
          updateProps(prevSlot.node, prevSlot.props, vnode.props);
          prevSlot.props = vnode.props;
        }
        prevSlot.childSlots = reconcileSlots(prevSlot.node, prevSlot.childSlots, vnode.children);
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }
      // ── Different tag → build fresh element ──
      // In live-only mode, only build when context is live.
      if (renderState.liveOnlyMode && _getCurrentBatch() !== 'live') {
        if (prevSlot) return { slot: prevSlot, node: prevSlot.node, replaced: false };
        const empty = document.createTextNode('');
        return {
          slot: { type: 'empty', node: empty, props: {}, childSlots: [], genInstance: null },
          node: empty,
          replaced: true,
        };
      }
      const el = document.createElement(vnode.type);
      applyProps(el, vnode.props);
      const inner = buildVNodeList(vnode.children);
      for (const c of inner.nodes) el.appendChild(c);
      return {
        slot: {
          type: vnode.type,
          node: el,
          props: vnode.props,
          childSlots: inner.slots,
          genInstance: null,
        },
        node: el,
        replaced: true,
      };
    } finally {
      if (elBatch !== undefined) _setCtxMap(prevCtxEl);
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
 * - If the instance does not consume `ctx` at all → returns `true`
 *   (vacuously stable — no rerender needed).
 * - If the instance consumes `ctx` without a selector → returns `false`
 *   (must rerender on any value change).
 * - If all selectors produce unchanged deps → returns `true` (stable).
 *
 * **Called by:** the props-unchanged path in `reconcileOne` above — to
 * decide whether a consumed context change actually requires a rerender
 * (it might not if all selectors are stable).
 *
 * @param inst     - The generator instance to check.
 * @param ctx      - The context whose value changed.
 * @param newValue - The new context value to test selectors against.
 * @returns `true` if no rerender is needed.
 */
function _hasStableContextSelectors(
  inst: GenInstance,
  ctx: Context<unknown>,
  newValue: unknown,
): boolean {
  let foundAny = false;
  for (const s of inst.hookStates) {
    if (s == null || typeof s !== 'object') continue;
    const state = s as UseContextState;
    if (state.ctx !== ctx) continue;
    foundAny = true;
    if (!state.selector) return false;
    const newDeps = state.selector(newValue);
    if (depsChanged(state.lastDeps, newDeps)) return false;
  }
  // If foundAny is false the instance doesn't consume this context → stable.
  return true;
}
