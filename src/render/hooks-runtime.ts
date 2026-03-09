/**
 * hooks-runtime.ts — Hook descriptor processing and component lifecycle utilities.
 *
 * This module is the bridge between the generator-based hook API and the
 * renderer. Components yield hook descriptors (tagged objects like
 * `{ type: $STATE, initialValue }`) from their generator body. The
 * renderer calls `runHooks` which drives the generator in a loop,
 * dispatching each descriptor to `processOneDescriptor` and sending the
 * result back via `gen.next(result)`.
 *
 * Also contains utilities for effect flushing, slot unmounting, descendant
 * collection, and context propagation.
 */

import {
  _getProviderCtx,
  _processContext,
  $CONTEXT,
  type Context,
  type UseContextState,
} from "../context";
import {
  $EFFECT,
  $ID,
  $MEMO,
  $REF,
  $RENDER,
  $RESOLVE,
  $RESOLVE_RAW,
  $STATE,
  $UI_PATCH,
  depsChanged,
  type HookContext,
} from "../hooks";
import { _processEffect } from "../hooks/$effect";
import { _processId } from "../hooks/$id";
import { _processMemo } from "../hooks/$memo";
import { _processRef } from "../hooks/$ref";
import { _processRender } from "../hooks/$render";
import { _processResolve, _processResolveRaw } from "../hooks/$resolve";
import { _processState } from "../hooks/$state";
import { _processUIPatch } from "../hooks/$ui-patch";
import type { Child } from "../jsx";
import { _flushPendingVNodes } from "./patch";
import { clearRef } from "./props";
import { renderState } from "./state";
import type { GenInstance, Slot } from "./types";

/**
 * Set of all known hook descriptor type symbols for fast membership test.
 *
 * When a generator yields a value, `isHookDescriptor` checks whether its
 * `type` field is one of these symbols. If yes, the yielded value is a
 * hook descriptor to be processed. If no, it's a real VNode (or Child)
 * representing the component's render output.
 */
const HOOK_SYMBOLS = new Set<symbol>([
  $STATE,
  $REF,
  $ID,
  $MEMO,
  $CONTEXT,
  $RESOLVE_RAW,
  $RESOLVE,
  $EFFECT,
  $RENDER,
  $UI_PATCH,
]);

/**
 * Returns true when a yielded value is a hook descriptor (not a VNode/Child).
 *
 * **Called by:** `runHooks` — in the dispatch loop, to distinguish hook
 * descriptors from actual render output.
 *
 * @param value - The value yielded by the component generator.
 */
export function isHookDescriptor(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    HOOK_SYMBOLS.has((value as { type: symbol }).type)
  );
}

/**
 * Run any `useEffect` callbacks that were queued during the last render pass.
 *
 * Effects are deferred until after the DOM is updated so that the effect
 * function can read the committed DOM state. Each effect receives an
 * `AbortSignal` that the effect can check for cancellation.
 *
 * The cleanup value returned by each effect function is stored in
 * `hookStates[hookIndex].cleanup` so that it can be called on the next
 * deps change or on component unmount.
 *
 * **Guards:** only fires when `instance.gen === null`, meaning the generator
 * has fully returned. If the generator is paused (e.g. inside `useRender`),
 * effects are not flushed until the generator completes.
 *
 * **Called by:**
 * - `executeRerender` in `mount.ts` — after `reconcileSlots` on both
 *   initial mount and subsequent rerenders.
 * - `resume` in `mount.ts` — after resuming a paused generator.
 * - `_flushPendingVNodes` in `patch.ts` — after reconciling a deferred
 *   component during `commitUIPatch`.
 *
 * @param instance - The generator instance whose effects to flush.
 */
export function flushEffects(instance: GenInstance): void {
  if (instance.gen !== null) return;
  for (const { hookIndex, fn, controller } of instance.pendingEffects) {
    const cleanup = fn(controller.signal);
    (
      instance.hookStates[hookIndex] as { deps: unknown[]; cleanup: (() => void) | undefined }
    ).cleanup = cleanup;
  }
  instance.pendingEffects.length = 0;
}

/**
 * Recursively tear down a slot and all its descendants.
 *
 * Calls every cleanup function registered by hooks (`useEffect`,
 * `useResolve`) on every `GenInstance` in the subtree. Also removes the
 * instance from `renderState.dirtyInstances` so that a pending
 * `commitUIPatch` doesn't try to reconcile a dead component.
 *
 * **Called by:** `reconcileSlots` in `reconciler.ts` — when a slot is
 * replaced (different type) or removed (the new children list is shorter).
 *
 * @param slot - The slot to unmount.
 */
export function unmountSlot(slot: Slot): void {
  for (const child of slot.childSlots) {
    unmountSlot(child);
  }
  // Clear $ref on HTML element slots
  if (typeof slot.type === "string" && slot.props["$ref"]) {
    clearRef(slot.props["$ref"]);
  }
  if (slot.genInstance) {
    for (const child of slot.genInstance.slots) {
      unmountSlot(child);
    }
    for (const fn of slot.genInstance.cleanupFns) {
      fn?.();
    }
    // Remove from global dirty set so commitUIPatch skips unmounted instances.
    // localPatchRefCount is intentionally left as-is; the local patch commit()
    // checks pendingVNode === undefined and skips accordingly.
    renderState.dirtyInstances.delete(slot.genInstance);
  }
}

/**
 * Collect all descendant `GenInstance`s reachable from `instance.slots`
 * via a depth-first traversal.
 *
 * **Called by:** `processOneDescriptor($UI_PATCH)` — `useUIPatch`'s
 * `startPatch()` function snapshots all current descendants at the moment
 * the patch begins. These are the instances that will have their
 * `localPatchRefCount` incremented (deferred) and later decremented
 * (committed).
 *
 * @param instance - The root instance whose descendants to collect.
 * @returns A flat array of all descendant `GenInstance`s (not including
 *   the root itself).
 */
export function collectDescendants(instance: GenInstance): GenInstance[] {
  const result: GenInstance[] = [];
  function walk(slots: Slot[]): void {
    for (const slot of slots) {
      if (slot.genInstance) {
        result.push(slot.genInstance);
        walk(slot.genInstance.slots);
      }
      walk(slot.childSlots);
    }
  }
  walk(instance.slots);
  return result;
}

/**
 * Process a single hook descriptor and return the value to send back to
 * the generator via `gen.next(value)`.
 *
 * This is the central dispatch function for all hooks. Each hook type
 * yields a descriptor object with a `type` symbol and associated data.
 * The actual processing logic lives in each hook's own file; this function
 * builds the shared `HookContext` and dispatches to the right handler.
 *
 * **Called by:** `runHooks` below — once for each hook descriptor yielded
 * during the component's generator body.
 *
 * @param descriptor    - The hook descriptor (e.g. `{ type: $STATE, initialValue: 0 }`).
 * @param hookIndex     - The positional index of this hook call (0-based, by call order).
 * @param hookStates    - The instance's persistent hook state array.
 * @param cleanupFns    - The instance's per-hook cleanup function array.
 * @param pendingEffects - The instance's queued-effects array (for `useEffect`).
 * @param rerender      - Function to trigger a full re-render of this component.
 * @param resume        - Function to resume a paused generator (for `useRender`).
 * @param instance      - The full `GenInstance` (needed by `useContext` and `useUIPatch`).
 * @returns The value to send back to the generator via `gen.next(value)`.
 */
export function processOneDescriptor(
  descriptor: { type: symbol; [key: string]: unknown },
  hookIndex: number,
  hookStates: unknown[],
  cleanupFns: ((() => void) | undefined)[],
  pendingEffects: Array<{
    hookIndex: number;
    fn: (signal: AbortSignal) => (() => void) | undefined;
    controller: AbortController;
  }>,
  rerender: () => Promise<void>,
  resume: () => void,
  instance: GenInstance,
): unknown {
  const ctx: HookContext = {
    hookIndex,
    hookStates,
    cleanupFns,
    pendingEffects,
    rerender,
    resume,
    instance,
    collectDescendants,
    flushPendingVNodes: _flushPendingVNodes,
  };

  switch (descriptor.type) {
    case $STATE:
      return _processState(descriptor, ctx);
    case $REF:
      return _processRef(descriptor, ctx);
    case $ID:
      return _processId(ctx);
    case $MEMO:
      return _processMemo(descriptor, ctx);
    case $CONTEXT:
      return _processContext(descriptor, ctx);
    case $RESOLVE_RAW:
      return _processResolveRaw(descriptor, ctx);
    case $RESOLVE:
      return _processResolve(descriptor, ctx);
    case $EFFECT:
      return _processEffect(descriptor, ctx);
    case $RENDER:
      return _processRender(descriptor, ctx);
    case $UI_PATCH:
      return _processUIPatch(ctx);
    default:
      throw new Error(`Unknown hook descriptor type: ${String(descriptor.type)}`);
  }
}

/**
 * Execute the component generator body, intercepting hook descriptors.
 *
 * Drives the generator in a loop:
 * 1. Call `gen.next(value)` to advance the generator.
 * 2. If the yielded value is a hook descriptor → process it via
 *    `processOneDescriptor`, send the result back, and repeat.
 * 3. If the yielded value is NOT a hook descriptor → it's a real VNode
 *    (the component's render output). Stop the loop.
 * 4. If the generator returns (done=true) → the returned value is the
 *    final VNode. Stop the loop.
 *
 * After each hook is processed, checks `instance.pendingRerender`. If
 * true (a `setState` was called during render), returns early with
 * `cancelled: true` so that `executeRerender` can retry with the
 * accumulated latest state.
 *
 * **Called by:** `executeRerender` in `mount.ts` — on every render cycle
 * (both initial mount and subsequent rerenders).
 *
 * @param gen      - The generator created by calling the component function.
 * @param instance - The component's `GenInstance`.
 * @param rerender - Function to trigger a rerender (passed to hook descriptors).
 * @param resume   - Function to resume a paused generator (passed to `useRender`).
 * @returns An object with:
 *   - `vnode`: the component's render output (a Child).
 *   - `gen`: the generator to store if it yielded (paused), or `null` if it returned.
 *   - `cancelled`: true if a mid-render state change aborted this render.
 */
export function runHooks(
  gen: Generator<unknown, Child, unknown>,
  instance: GenInstance,
  rerender: () => Promise<void>,
  resume: () => void,
): {
  vnode: Child;
  gen: Generator<unknown, Child, unknown> | null;
  cancelled: boolean;
} {
  let hookIndex = 0;
  let result = gen.next(undefined as unknown);

  while (!result.done && isHookDescriptor(result.value)) {
    const descriptor = result.value as { type: symbol; [key: string]: unknown };
    const value = processOneDescriptor(
      descriptor,
      hookIndex++,
      instance.hookStates,
      instance.cleanupFns,
      instance.pendingEffects,
      rerender,
      resume,
      instance,
    );
    // A mid-render state change was queued — abort this stale render so the
    // next iteration of executeRerender picks up the accumulated latest state.
    if (instance.pendingRerender) {
      return { vnode: null, gen: null, cancelled: true };
    }
    result = gen.next(value);
  }

  return {
    vnode: (result.value as Child) ?? null,
    gen: result.done ? null : gen,
    cancelled: false,
  };
}

/**
 * Returns `true` when every `useContext` hook call in `inst` that subscribes
 * to `ctx` has a selector whose selected deps are unchanged under `newValue`.
 *
 * An instance that consumes `ctx` without a selector always returns `false`
 * because it must rerender whenever the Provider value changes.
 *
 * **Called by:** `propagateContextUpdate` below — to decide whether a
 * descendant consumer needs a rerender when an ancestor Provider's value
 * changes. If all selectors are stable, the rerender is skipped.
 *
 * @param inst     - The generator instance to check.
 * @param ctx      - The context whose value changed.
 * @param newValue - The new value supplied by the Provider.
 * @returns `true` if no rerender is needed (all selectors stable or context not consumed).
 */
function _hasStableSelectors(inst: GenInstance, ctx: Context<unknown>, newValue: unknown): boolean {
  for (const s of inst.hookStates) {
    if (s == null || typeof s !== "object") continue;
    const state = s as UseContextState;
    if (state.ctx !== ctx) continue;
    if (!state.selector) return false;
    const newDeps = state.selector(newValue);
    if (depsChanged(state.lastDeps, newDeps)) return false;
  }
  return true;
}

/**
 * Walk all descendant slots and propagate a context value change.
 *
 * When a context Provider's `value` prop changes, this function:
 * 1. Updates `capturedCtx` on every descendant `GenInstance` so that any
 *    future self-triggered re-render uses the new value.
 * 2. Immediately re-renders instances that **consumed** the changed context
 *    in their last render (tracked via `consumedContexts`), unless all their
 *    selectors have stable deps under the new value.
 * 3. Stops recursing into subtrees guarded by an inner Provider for the
 *    *same* context — those subtrees override the outer value.
 *
 * **Called by:** `reconcileOne` in `reconciler.ts` — when a Provider's
 * `value` prop changed and the Provider is being reconciled in-place
 * (same type at same position).
 *
 * @param ctx      - The context whose value changed.
 * @param newValue - The new value supplied by the Provider.
 * @param slots    - The descendant slot tree to walk (typically a Provider's
 *                   `childSlots` or a generator instance's `slots`).
 */
export function propagateContextUpdate(
  ctx: Context<unknown>,
  newValue: unknown,
  slots: import("./types").Slot[],
): void {
  for (const slot of slots) {
    // Stop at an inner Provider for the same context – it overrides the outer value.
    if (typeof slot.type === "function" && _getProviderCtx(slot.type) === ctx) {
      continue;
    }

    const inst = slot.genInstance;
    if (inst) {
      // Keep capturedCtx current so future self-triggered re-renders use the
      // new value even if this component doesn't consume the changed context.
      const updated = new Map(inst.capturedCtx);
      updated.set(ctx, newValue);
      inst.capturedCtx = updated;

      if (inst.consumedContexts.has(ctx) && !_hasStableSelectors(inst, ctx, newValue)) {
        // Re-render this consumer.  rerender() calls reconcileSlots on its
        // children with the updated capturedCtx, so we don't recurse further.
        inst.rerender();
      } else {
        // This component doesn't consume the context (or all its selectors
        // are stable), but its rendered children might.  Recurse into its
        // internal slots.
        propagateContextUpdate(ctx, newValue, inst.slots);
      }
    }

    // Recurse into HTML-element child slots (genInstance slots have none).
    if (slot.childSlots.length > 0) {
      propagateContextUpdate(ctx, newValue, slot.childSlots);
    }
  }
}
