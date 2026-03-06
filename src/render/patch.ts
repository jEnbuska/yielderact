import { type GenInstance } from './types';
import { renderState } from './state';
import { flushEffects } from './hooks-runtime';
import { reconcileSlots } from './reconciler';

/**
 * Reconcile each instance in `instances` that has a pending VNode.
 * Called by both `commitUIPatch` (global) and local-patch `commit()`.
 */
export function _flushPendingVNodes(instances: GenInstance[]): void {
  for (const inst of instances) {
    if (inst.pendingVNode === undefined) continue;
    const vnode = inst.pendingVNode;
    inst.pendingVNode = undefined;
    renderState.dirtyInstances.delete(inst);

    const prevBatch = renderState.currentBatchBehavior;
    renderState.currentBatchBehavior = inst.batchBehavior;
    try {
      inst.slots = reconcileSlots(inst.host, inst.slots, [vnode]);
    } finally {
      renderState.currentBatchBehavior = prevBatch;
    }
    flushEffects(inst);
  }
}

/**
 * Begin a global UI patch.  All components with `$patch="default"` (the
 * default) will defer their DOM writes until `commitUIPatch` is called.
 * Patches are reference-counted; `commitUIPatch` must be called once per
 * `startUIPatch` call.
 */
export function startUIPatch(): void {
  renderState.patchDepth++;
}

/**
 * Commit the global UI patch, applying all deferred DOM updates at once.
 * Must be called once per matching `startUIPatch` call.
 */
export function commitUIPatch(): void {
  if (renderState.patchDepth === 0) return;
  renderState.patchDepth--;
  if (renderState.patchDepth > 0) return; // nested patch still active

  const pending = [...renderState.dirtyInstances];
  renderState.dirtyInstances.clear();
  _flushPendingVNodes(pending);
}
