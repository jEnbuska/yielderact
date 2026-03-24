import { _withBatch } from "../context";
import { getPatchMode } from "./helpers";
import { flushEffects } from "./hooks-runtime";
import { reconcileSlots } from "./reconciler";
import { _requireActiveCtx } from "./state";
import type { ComponentInstance } from "./types";

/**
 * Apply deferred DOM updates for a list of component instances.
 *
 * Each instance with a `pendingVNode` gets its DOM reconciled and effects
 * flushed. Instances without a pending update are skipped.
 */
export function _flushPendingVNodes(instances: ComponentInstance[]): void {
  for (const inst of instances) {
    if (inst.pendingVNode === undefined) continue;
    if (!inst.endMarker.parentNode) continue;
    const vnode = inst.pendingVNode;
    inst.pendingVNode = undefined;
    inst.renderCtx.dirtyInstances.delete(inst);

    // Compute effective context: inherited context + own $patch for children.
    const ownPatch = getPatchMode(inst.props);
    const ctxMap =
      ownPatch !== undefined ? _withBatch(inst.capturedCtx, ownPatch) : inst.capturedCtx;
    const parent = inst.endMarker.parentNode as HTMLElement;
    inst.slots = reconcileSlots(parent, inst.slots, [vnode], inst.endMarker, ctxMap);
    flushEffects(inst);
  }
}

/**
 * Begin a global UI patch.
 *
 * While a global patch is active (`renderCtx.patchDepth > 0`), all
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
  _requireActiveCtx().patchDepth++;
}

/**
 * Commit the global UI patch, applying all deferred DOM updates at once.
 *
 * Decrements the reference count. When it reaches 0 (outermost patch),
 * drains `renderCtx.dirtyInstances` and calls `_flushPendingVNodes`
 * to reconcile every pending VNode.
 *
 * Must be called exactly once for each matching `startUIPatch` call.
 *
 * **Called by:** Application code — after all state updates in the batch
 * have been triggered.
 */
export function commitUIPatch(): void {
  const rctx = _requireActiveCtx();
  if (rctx.patchDepth === 0) return;
  rctx.patchDepth--;
  if (rctx.patchDepth > 0) return; // nested patch still active

  const pending = [...rctx.dirtyInstances];
  rctx.dirtyInstances.clear();
  _flushPendingVNodes(pending);
}
