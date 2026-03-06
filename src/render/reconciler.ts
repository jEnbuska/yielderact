import { type VNode, type Child, type AnyComponentFn, type PlainComponentFn } from '../jsx';
import {
  _getCtxMap,
  _setCtxMap,
  _getProviderCtx,
  _resolveCtxValue,
  type Context,
} from '../context';
import { depsChanged } from '../hooks';
import { type Slot, type GenInstance } from './types';
import { renderState } from './state';
import { applyProps, updateProps } from './props';
import { isGeneratorFn, shallowEqual, flattenChildren, mergedProps, isShown } from './helpers';
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
 * Children are matched by position.  For each position:
 *  - Same type + same props (shallow equal) → keep existing DOM node unchanged
 *  - Same type + changed props → update in place (elements) or remount (components)
 *  - Different type → replace
 *
 * Returns the updated slot array.
 */
export function reconcileSlots(
  parent: HTMLElement,
  prevSlots: Slot[],
  nextVNodes: Child[],
): Slot[] {
  // Flatten fragments before reconciling
  const flatNext = flattenChildren(nextVNodes);
  const nextSlots: Slot[] = [];

  for (let i = 0; i < flatNext.length; i++) {
    const prevSlot = prevSlots[i] ?? null;
    const { slot, node, replaced } = reconcileOne(prevSlot, flatNext[i]);
    nextSlots.push(slot);

    if (replaced) {
      if (prevSlot) unmountSlot(prevSlot);
      if (prevSlot && prevSlot.node.parentNode === parent) {
        parent.replaceChild(node, prevSlot.node);
      } else {
        // Insertion point: before the (i+1)-th existing child
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

  // Remove any extra old DOM nodes
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
 * Returns:
 *  - `slot`    – the updated (or new) Slot object
 *  - `node`    – the real DOM node for this slot
 *  - `replaced` – true if the DOM node changed and needs to be swapped in
 */
function reconcileOne(
  prevSlot: Slot | null,
  nextChild: Child,
): { slot: Slot; node: Node; replaced: boolean } {
  // ---- Empty / null ----
  if (nextChild == null || nextChild === false) {
    // In live-only mode, skip removal unless we're in a live context OR the
    // existing slot is a $patch="live" component (it knows it's live).
    if (renderState.liveOnlyMode && prevSlot) {
      const prevIsLive = prevSlot.genInstance?.batchBehavior === 'live';
      if (renderState.currentBatchBehavior !== 'live' && !prevIsLive) {
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

  // ---- Primitive (text / number) ----
  if (typeof nextChild === 'string' || typeof nextChild === 'number') {
    const text = String(nextChild);
    if (prevSlot?.type === 'text' && prevSlot.node instanceof Text) {
      // In live-only mode, only update text when the current batch context is live.
      if (
        (!renderState.liveOnlyMode || renderState.currentBatchBehavior === 'live') &&
        prevSlot.node.textContent !== text
      ) {
        prevSlot.node.textContent = text;
        prevSlot.props = { text };
      }
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    // In live-only default mode, don't insert new text nodes.
    if (renderState.liveOnlyMode && renderState.currentBatchBehavior !== 'live' && prevSlot) {
      return { slot: prevSlot, node: prevSlot.node, replaced: false };
    }
    const node = document.createTextNode(text);
    return {
      slot: { type: 'text', node, props: { text }, childSlots: [], genInstance: null },
      node,
      replaced: true,
    };
  }

  const vnode = nextChild as VNode;

  // ---- $shown === false: unmount and render empty placeholder ----
  const allPropsForShown = mergedProps(vnode);
  if (!isShown(allPropsForShown)) {
    // In live-only mode, only hide immediately when the effective batch is live.
    if (renderState.liveOnlyMode) {
      const effectiveBatch =
        (allPropsForShown['$patch'] as 'live' | 'default' | undefined) ??
        renderState.currentBatchBehavior;
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

  // ---- Function component ----
  if (typeof vnode.type === 'function') {
    const allProps = allPropsForShown;
    const fn = vnode.type as AnyComponentFn;
    const providerCtx = _getProviderCtx(fn);

    // Same component type at same position
    if (prevSlot?.type === vnode.type) {
      // Props unchanged → skip entirely (key memoization).
      // Exception: if this is a generator component whose consumed context has
      // changed since its last render, we must re-render it even though props
      // are the same.
      if (shallowEqual(prevSlot.props, allProps)) {
        const inst = prevSlot.genInstance;
        if (inst) {
          const ownBatch =
            (allProps['$patch'] as 'live' | 'default' | undefined) ??
            renderState.currentBatchBehavior;
          inst.batchBehavior = ownBatch;

          // Check if any consumed context value differs from capturedCtx.
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
          }
        }
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }

      // In live-only mode, skip non-live components — their update is deferred.
      if (renderState.liveOnlyMode) {
        const effectiveBatch =
          (allProps['$patch'] as 'live' | 'default' | undefined) ??
          renderState.currentBatchBehavior;
        if (effectiveBatch !== 'live') {
          if (prevSlot.genInstance) prevSlot.genInstance.batchBehavior = effectiveBatch;
          // Forward only framework meta-prop changes ($patch, $shown) to prevent
          // spurious remounts at commit time when e.g. $patch mode changed.
          // Content prop changes (e.g. isPending: false) must NOT be written here —
          // they must survive to commit so that shallowEqual detects the diff and
          // the component is actually re-rendered with the new props.
          if (!providerCtx) {
            const hasContentChange = Object.keys({ ...prevSlot.props, ...allProps }).some(
              (k) => k !== '$patch' && k !== '$shown' && !Object.is(prevSlot.props[k], allProps[k]),
            );
            if (!hasContentChange) prevSlot.props = allProps;
          }
          return { slot: prevSlot, node: prevSlot.node, replaced: false };
        }
      }

      // Context Provider: always reconcile children in-place regardless of whether
      // the value changed.  When the value DID change, first propagate the update
      // to all descendant generator instances so their capturedCtx stays current
      // and consumers are immediately re-rendered.
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

      // Generator component with changed props → rerender in place to preserve
      // hook state (useState, useRef, useEffect, etc.).
      if (prevSlot.genInstance) {
        prevSlot.genInstance.props = allProps;
        prevSlot.genInstance.batchBehavior =
          (allProps['$patch'] as 'live' | 'default' | undefined) ??
          renderState.currentBatchBehavior;
        prevSlot.genInstance.rerender();
        prevSlot.props = allProps;
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }

      // Plain function component → remount from scratch.
    }

    // In live-only mode, structural changes (type mismatch or no prevSlot) only proceed
    // when the effective batch for the incoming component is live.  Same-type $patch="live"
    // components fell through the block above on purpose and proceed to the remount below.
    if (renderState.liveOnlyMode && prevSlot?.type !== vnode.type) {
      const effectiveBatch =
        (allProps['$patch'] as 'live' | 'default' | undefined) ?? renderState.currentBatchBehavior;
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

    // Mount fresh component
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

  // ---- HTML element ----
  if (typeof vnode.type === 'string') {
    // Propagate $patch to children if the element specifies it.
    const elBatch = vnode.props['$patch'] as 'live' | 'default' | undefined;
    const prevBatchEl = renderState.currentBatchBehavior;
    if (elBatch !== undefined) renderState.currentBatchBehavior = elBatch;
    try {
      if (prevSlot?.type === vnode.type && prevSlot.node instanceof HTMLElement) {
        // Same tag → update props in place and reconcile children.
        // In live-only mode skip own prop updates when the context is frozen; when
        // the context is live (inside a $patch="live" ancestor), update normally.
        if (!renderState.liveOnlyMode || renderState.currentBatchBehavior === 'live') {
          updateProps(prevSlot.node, prevSlot.props, vnode.props);
          prevSlot.props = vnode.props;
        }
        prevSlot.childSlots = reconcileSlots(prevSlot.node, prevSlot.childSlots, vnode.children);
        return { slot: prevSlot, node: prevSlot.node, replaced: false };
      }
      // Different tag: in live-only mode only build when context is live.
      if (renderState.liveOnlyMode && renderState.currentBatchBehavior !== 'live') {
        if (prevSlot) return { slot: prevSlot, node: prevSlot.node, replaced: false };
        const empty = document.createTextNode('');
        return {
          slot: { type: 'empty', node: empty, props: {}, childSlots: [], genInstance: null },
          node: empty,
          replaced: true,
        };
      }
      // Different tag → build fresh
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
      renderState.currentBatchBehavior = prevBatchEl;
    }
  }

  // ---- Fragment or anything else: full rebuild ----
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
 * An instance that does not consume `ctx` at all is considered stable
 * (vacuously true — no rerender needed for it).
 * An instance that consumes `ctx` without a selector always returns `false`
 * because it must rerender whenever the Provider value changes.
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
