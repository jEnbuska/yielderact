import { type GenInstance } from './types';
import { renderState } from './state';
import { _getCtxMap, _setCtxMap, _withBatch } from '../context';
import { flushEffects } from './hooks-runtime';
import { reconcileSlots } from './reconciler';

/**
 * Apply deferred DOM updates for a list of generator instances.
 *
 * Each instance with a `pendingVNode` gets its DOM reconciled: the pending
 * VNode is passed to `reconcileSlots`, which diffs the instance's current
 * slots against the new VNode tree and applies the minimal DOM mutations.
 * After reconciliation, `flushEffects` runs any queued `useEffect` callbacks.
 *
 * Before reconciling, the context map is temporarily set to the instance's
 * `capturedCtx` (with its own `$patch` applied if present), so that child
 * components see the correct context values during the reconciliation walk.
 *
 * **Called by:**
 * - `commitUIPatch()` below — drains `renderState.dirtyInstances` and
 *   flushes all globally-deferred instances.
 * - `useUIPatch`'s `commit()` function (via `processOneDescriptor` in
 *   `hooks-runtime.ts`) — flushes locally-deferred instances when the
 *   local patch is committed.
 *
 * @param instances - The list of instances to flush. Instances with
 *   `pendingVNode === undefined` are skipped (no pending update).
 */
export function _flushPendingVNodes(instances: GenInstance[]): void {
  for (const inst of instances) {
    if (inst.pendingVNode === undefined) continue;
    const vnode = inst.pendingVNode;
    inst.pendingVNode = undefined;
    renderState.dirtyInstances.delete(inst);

    const prevCtx = _getCtxMap();
    // Restore inherited context, then apply own $patch for children.
    const ownPatch = inst.props['$patch'] as 'live' | 'default' | undefined;
    _setCtxMap(ownPatch !== undefined ? _withBatch(inst.capturedCtx, ownPatch) : inst.capturedCtx);
    try {
      inst.slots = reconcileSlots(inst.host, inst.slots, [vnode]);
    } finally {
      _setCtxMap(prevCtx);
    }
    flushEffects(inst);
  }
}

/**
 * Begin a global UI patch.
 *
 * While a global patch is active (`renderState.patchDepth > 0`), all
 * `$patch="default"` components (the default) defer their DOM writes:
 * they compute their new VNode but store it as `pendingVNode` instead of
 * reconciling the DOM. Only `$patch="live"` components update immediately.
 *
 * Patches are **reference-counted**: `commitUIPatch` must be called once
 * for every `startUIPatch` call. Nested patches are supported — only the
 * outermost `commitUIPatch` actually flushes.
 *
 * **Called by:** Application code — typically before triggering a batch of
 * state updates (e.g. fetching data and updating multiple components).
 *
 * @example
 * startUIPatch();
 * setLoading(true);     // deferred
 * setData(newData);     // deferred
 * commitUIPatch();      // both updates applied at once
 */
export function startUIPatch(): void {
  renderState.patchDepth++;
}

/**
 * Commit the global UI patch, applying all deferred DOM updates at once.
 *
 * Decrements the reference count. When it reaches 0 (outermost patch),
 * drains `renderState.dirtyInstances` and calls `_flushPendingVNodes`
 * to reconcile every pending VNode.
 *
 * Must be called exactly once for each matching `startUIPatch` call.
 *
 * **Called by:** Application code — after all state updates in the batch
 * have been triggered.
 */
export function commitUIPatch(): void {
  if (renderState.patchDepth === 0) return;
  renderState.patchDepth--;
  if (renderState.patchDepth > 0) return; // nested patch still active

  const pending = [...renderState.dirtyInstances];
  renderState.dirtyInstances.clear();
  _flushPendingVNodes(pending);
}
