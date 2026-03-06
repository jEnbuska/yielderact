import { type VNode, type Child, type AnyComponentFn, type PlainComponentFn } from '../jsx';
import { _getCtxMap, _setCtxMap, _getProviderCtx } from '../context';
import { type Slot } from './types';
import { renderState } from './state';
import { applyProps, updateProps } from './props';
import { isGeneratorFn, shallowEqual, flattenChildren, mergedProps, isShown } from './helpers';
import { unmountSlot } from './hooks-runtime';
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
      // Props unchanged → skip entirely (key memoization)
      if (shallowEqual(prevSlot.props, allProps)) {
        // Still refresh batchBehavior in case an ancestor's $patch changed.
        if (prevSlot.genInstance) {
          const ownBatch =
            (allProps['$patch'] as 'live' | 'default' | undefined) ??
            renderState.currentBatchBehavior;
          prevSlot.genInstance.batchBehavior = ownBatch;
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
          // Keep prevSlot.props in sync with the pending props so that the commit-time
          // reconcile sees shallowEqual → true and skips a spurious remount.
          // Skip for context Providers — their value change must survive to commit.
          if (!providerCtx) prevSlot.props = allProps;
          return { slot: prevSlot, node: prevSlot.node, replaced: false };
        }
      }

      // Context Provider whose value is unchanged but children differ → reconcile
      // children in-place.  This preserves child component state (hook states,
      // generator cursors) across parent re-renders when only the rendered
      // subtree changes, not the context value itself.
      //
      // If the value DID change we fall through to the full remount so that
      // already-mounted descendants pick up the new context (their capturedCtx
      // is refreshed via the remount).
      if (providerCtx && Object.is(prevSlot.props['value'], allProps['value'])) {
        const prevCtxMap = _getCtxMap();
        const newCtxMap = new Map(prevCtxMap);
        newCtxMap.set(providerCtx as never, allProps.value as unknown);
        _setCtxMap(newCtxMap);
        try {
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

      // Other component types (or Provider whose value changed) → remount from scratch.
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
