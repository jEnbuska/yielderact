/**
 * hooks-runtime.ts — Hook descriptor processing and component lifecycle utilities.
 *
 * This module is the bridge between the generator-based hook API and the
 * renderer. Components yield hook descriptors (tagged objects like
 * `{ type: USE_STATE, initialValue }`) from their generator body. The
 * renderer calls `runHooks` which drives the generator in a loop,
 * dispatching each descriptor to `processOneDescriptor` and sending the
 * result back via `gen.next(result)`.
 *
 * Also contains utilities for effect flushing, slot unmounting, descendant
 * collection, and context propagation.
 */

import { type Child } from '../jsx';
import {
  _getCtxMap,
  USE_CONTEXT,
  type Context,
  _getProviderCtx,
  _resolveCtxValue,
} from '../context';
import { clearRef } from './props';
import {
  USE_STATE,
  USE_REF,
  USE_ID,
  USE_MEMO,
  USE_RESOLVE_RAW,
  USE_RESOLVE,
  USE_EFFECT,
  USE_RENDER,
  USE_UI_PATCH,
  depsChanged,
  type ResolveRawResult,
  type UseRenderState,
} from '../hooks';
import { type Slot, type GenInstance } from './types';
import { renderState } from './state';
import { _flushPendingVNodes } from './patch';

/**
 * Set of all known hook descriptor type symbols for fast membership test.
 *
 * When a generator yields a value, `isHookDescriptor` checks whether its
 * `type` field is one of these symbols. If yes, the yielded value is a
 * hook descriptor to be processed. If no, it's a real VNode (or Child)
 * representing the component's render output.
 */
const HOOK_SYMBOLS = new Set<symbol>([
  USE_STATE,
  USE_REF,
  USE_ID,
  USE_MEMO,
  USE_CONTEXT,
  USE_RESOLVE_RAW,
  USE_RESOLVE,
  USE_EFFECT,
  USE_RENDER,
  USE_UI_PATCH,
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
    typeof value === 'object' &&
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
    (instance.hookStates[hookIndex] as { deps: unknown[]; cleanup: (() => void) | void }).cleanup =
      cleanup;
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
  if (typeof slot.type === 'string' && slot.props['$ref']) {
    clearRef(slot.props['$ref']);
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
 * **Called by:** `processOneDescriptor(USE_UI_PATCH)` — `useUIPatch`'s
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
 * Persistent hook state stored for a `useContext` call.
 *
 * Stored in `GenInstance.hookStates[hookIndex]` for each `useContext` hook.
 * The reconciler reads these entries to determine whether a context change
 * requires a rerender (by checking `selector` and `lastDeps`).
 *
 * @internal
 */
export type UseContextState = {
  /** The context object this hook subscribes to. */
  ctx: Context<unknown>;
  /** Optional selector function — extracts deps from the context value. */
  selector: ((ctx: unknown) => unknown[]) | undefined;
  /** Optional transform function — computes the returned value from deps. */
  transform: ((...args: unknown[]) => unknown) | undefined;
  /** The last computed deps array (from `selector`). Used by `depsChanged`. */
  lastDeps: unknown[] | undefined;
  /** The last returned value (raw context value, or `transform(…deps)`). */
  lastResult: unknown;
};

/**
 * Process a single hook descriptor and return the value to send back to
 * the generator via `gen.next(value)`.
 *
 * This is the central dispatch function for all hooks. Each hook type
 * yields a descriptor object with a `type` symbol and associated data.
 * This function reads/writes `hookStates[hookIndex]` to persist state
 * across re-renders, and may register cleanup functions in `cleanupFns`
 * or queue effects in `pendingEffects`.
 *
 * **Called by:** `runHooks` below — once for each hook descriptor yielded
 * during the component's generator body.
 *
 * @param descriptor    - The hook descriptor (e.g. `{ type: USE_STATE, initialValue: 0 }`).
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
    fn: (signal: AbortSignal) => (() => void) | void;
    controller: AbortController;
  }>,
  rerender: () => Promise<void>,
  resume: () => void,
  instance: GenInstance,
): unknown {
  switch (descriptor.type) {
    // ── useState ──
    // Returns `[currentValue, setter]`. The setter calls `rerender()`,
    // which either re-executes the generator immediately or queues a
    // pending rerender if one is already in progress.
    case USE_STATE: {
      if (!(hookIndex in hookStates)) {
        const init = descriptor['initialValue'];
        hookStates[hookIndex] = typeof init === 'function' ? (init as () => unknown)() : init;
      }
      const setter = (newValue: unknown): Promise<void> => {
        hookStates[hookIndex] =
          typeof newValue === 'function'
            ? (newValue as (prev: unknown) => unknown)(hookStates[hookIndex])
            : newValue;
        return rerender();
      };
      return [hookStates[hookIndex], setter];
    }

    // ── useRef ──
    // Returns a stable `{ current: T }` object that persists across renders.
    case USE_REF: {
      if (!(hookIndex in hookStates)) {
        hookStates[hookIndex] = { current: descriptor['initialValue'] };
      }
      return hookStates[hookIndex];
    }

    // ── useId ──
    // Returns a stable unique ID string (e.g. ":r0:", ":r1:").
    // The ID is generated on first mount and reused on rerenders.
    case USE_ID: {
      if (!(hookIndex in hookStates)) {
        hookStates[hookIndex] = `:r${renderState.idCounter++}:`;
      }
      return hookStates[hookIndex];
    }

    // ── useMemo ──
    // Returns `fn(...deps)`, recomputed only when `deps` change.
    case USE_MEMO: {
      const fn = descriptor['fn'] as (...args: unknown[]) => unknown;
      const deps = descriptor['deps'] as unknown[];
      const existing = hookStates[hookIndex] as { value: unknown; deps: unknown[] } | undefined;
      if (!existing || depsChanged(existing.deps, deps)) {
        hookStates[hookIndex] = { value: fn(...deps), deps };
      }
      return (hookStates[hookIndex] as { value: unknown }).value;
    }

    // ── useContext ──
    // Reads a context value from the active `_ctxMap`. Registers the
    // context in `instance.consumedContexts` so the reconciler knows
    // this component subscribes to it.
    //
    // Without a selector: returns the raw value, rerenders on any change.
    // With a selector: returns the raw value (or transformed result),
    // rerenders only when selected deps change.
    case USE_CONTEXT: {
      const ctx = descriptor['ctx'] as Context<unknown>;
      instance.consumedContexts.add(ctx);
      const selector = descriptor['selector'] as ((ctx: unknown) => unknown[]) | undefined;
      const transform = descriptor['transform'] as ((...args: unknown[]) => unknown) | undefined;
      const ctxMap = _getCtxMap();
      const rawValue = ctxMap.has(ctx) ? ctxMap.get(ctx) : ctx._defaultValue;

      if (!selector) {
        hookStates[hookIndex] = {
          ctx,
          selector: undefined,
          transform: undefined,
          lastDeps: undefined,
          lastResult: rawValue,
        } satisfies UseContextState;
        return rawValue;
      }

      const newDeps = selector(rawValue);
      const prev = hookStates[hookIndex] as UseContextState | undefined;
      if (prev?.selector && !depsChanged(prev.lastDeps, newDeps)) {
        return prev.lastResult;
      }
      const result = transform ? transform(...newDeps) : rawValue;
      hookStates[hookIndex] = {
        ctx,
        selector,
        transform,
        lastDeps: newDeps,
        lastResult: result,
      } satisfies UseContextState;
      return result;
    }

    // ── useResolveRaw ──
    // Tracks a Promise. Returns `{ data, loading, error }`.
    // When the promise resolves/rejects, triggers a rerender.
    // The hook re-subscribes when the promise reference changes.
    case USE_RESOLVE_RAW: {
      type RawState =
        | { promise: Promise<unknown>; status: 'pending' }
        | { promise: Promise<unknown>; status: 'resolved'; data: unknown }
        | { promise: Promise<unknown>; status: 'rejected'; error: unknown };

      const promise = descriptor['promise'] as Promise<unknown>;
      const existing = hookStates[hookIndex] as RawState | undefined;

      if (!existing || existing.promise !== promise) {
        const state: RawState = { promise, status: 'pending' };
        hookStates[hookIndex] = state;
        promise.then(
          (data) => {
            if (hookStates[hookIndex] === state) {
              hookStates[hookIndex] = { promise, status: 'resolved', data };
              rerender();
            }
          },
          (error) => {
            if (hookStates[hookIndex] === state) {
              hookStates[hookIndex] = { promise, status: 'rejected', error };
              rerender();
            }
          },
        );
      }

      const s = hookStates[hookIndex] as RawState;
      if (s.status === 'resolved')
        return { data: s.data, loading: false, error: undefined } as ResolveRawResult<unknown>;
      if (s.status === 'rejected')
        return { data: undefined, loading: false, error: s.error } as ResolveRawResult<unknown>;
      return { data: undefined, loading: true, error: undefined } as ResolveRawResult<unknown>;
    }

    // ── useResolve ──
    // Like useResolveRaw but creates the Promise via `fn(signal)` and
    // re-invokes when `deps` change. Aborts the previous AbortController
    // on deps change. Registers a cleanup function so the controller is
    // also aborted on component unmount.
    //
    // Returns the Promise (the generator yields a VNode to display while
    // the promise is pending, then `resume()` is called when it resolves).
    case USE_RESOLVE: {
      type ResolveState = {
        deps: unknown[];
        promise: Promise<unknown>;
        controller: AbortController;
      };
      const fn = descriptor['fn'] as (signal: AbortSignal) => Promise<unknown>;
      const deps = descriptor['deps'] as unknown[];
      const existing = hookStates[hookIndex] as ResolveState | undefined;

      if (!existing || depsChanged(existing.deps, deps)) {
        // Abort the previous controller before starting a new fetch.
        existing?.controller.abort();
        const controller = new AbortController();
        const promise = fn(controller.signal);
        hookStates[hookIndex] = { deps, promise, controller } satisfies ResolveState;
        // Register cleanup so the controller is aborted on component unmount.
        cleanupFns[hookIndex] = () => controller.abort();
        return promise;
      }
      return existing.promise;
    }

    // ── useEffect ──
    // Queues a side-effect to run AFTER the DOM is updated.
    // The effect function receives an AbortSignal and may return a cleanup.
    //
    // On deps change:
    //   1. Abort the previous signal.
    //   2. Call previous cleanup synchronously.
    //   3. Create a new AbortController.
    //   4. Queue the effect in `pendingEffects` (flushed by `flushEffects`).
    //
    // On unmount: the registered `cleanupFns[hookIndex]` aborts the signal
    // and calls the cleanup.
    case USE_EFFECT: {
      type EffectState = {
        deps: unknown[];
        cleanup: (() => void) | void;
        controller: AbortController;
      };
      const fn = descriptor['fn'] as (signal: AbortSignal) => (() => void) | void;
      const deps = descriptor['deps'] as unknown[];
      const existing = hookStates[hookIndex] as EffectState | undefined;

      if (!existing || depsChanged(existing.deps, deps)) {
        // Abort previous signal and run cleanup synchronously before the new effect.
        if (existing) {
          existing.controller.abort();
          existing.cleanup?.();
        }
        // Create a fresh AbortController for the new effect run.
        const controller = new AbortController();
        // Store updated deps; cleanup will be filled in by flushEffects after DOM update.
        hookStates[hookIndex] = { deps, cleanup: undefined, controller } satisfies EffectState;
        // Queue the effect to run after reconciliation.
        pendingEffects.push({ hookIndex, fn, controller });
        // Register unmount cleanup: abort the signal then call the returned cleanup fn.
        cleanupFns[hookIndex] = () => {
          const state = hookStates[hookIndex] as EffectState;
          state.controller.abort();
          state.cleanup?.();
        };
      }
      return undefined;
    }

    // ── useRender ──
    // Pauses the generator and renders intermediate UI (e.g. a dialog or
    // loading screen). The generator is resumed when `resumeCallback(value)`
    // is called from the rendered UI.
    //
    // Returns `{ slot, resumeCallback }` to the generator. The generator
    // then yields a VNode (the intermediate UI) which pauses it. When the
    // UI calls `resumeCallback(value)`, `resume()` is called, which calls
    // `gen.next()` to continue the generator with the returned value.
    //
    // The `resumeCallback` is stable across rerenders (same deps).
    // On deps change, a new slot/callback pair is created.
    case USE_RENDER: {
      const deps = descriptor['deps'] as unknown[];
      let slot = hookStates[hookIndex] as UseRenderState<unknown> | undefined;

      if (!slot || depsChanged(slot.deps, deps)) {
        // New slot – create a fresh resumeCallback that closes over the slot ref.
        const newSlot: UseRenderState<unknown> = {
          status: 'waiting',
          deps,
          value: undefined,
          resumeCallback: null!,
        };
        hookStates[hookIndex] = newSlot;
        newSlot.resumeCallback = (value: unknown): void => {
          const s = hookStates[hookIndex] as UseRenderState<unknown>;
          if (s.status === 'waiting') {
            s.status = 'resolved';
            s.value = value;
            resume();
          }
        };
        slot = newSlot;
      } else {
        // Same deps – reuse stable callback, just reset status for this fresh run.
        slot.status = 'waiting';
      }

      return { slot, resumeCallback: slot.resumeCallback };
    }

    // ── useUIPatch ──
    // Returns a stable `startPatch()` function. When called, it:
    //   1. Snapshots all current descendant instances.
    //   2. Increments `localPatchRefCount` on the root + all descendants,
    //      causing their DOM writes to be deferred.
    //   3. Returns a `commit()` function that decrements the counts and
    //      calls `_flushPendingVNodes` to apply all deferred updates.
    //
    // The `startPatch` function is created once (on first mount) and
    // reused on every rerender (stable reference).
    case USE_UI_PATCH: {
      if (!(hookIndex in hookStates)) {
        hookStates[hookIndex] = (): (() => void) => {
          // Snapshot taken lazily at call time (not at hook registration time)
          // so that `instance.slots` is fully populated.
          const snapshot = collectDescendants(instance);

          // Freeze root + all current descendants.
          instance.localPatchRefCount++;
          for (const inst of snapshot) inst.localPatchRefCount++;

          return (): void => {
            // Unfreeze all.
            instance.localPatchRefCount = Math.max(0, instance.localPatchRefCount - 1);
            for (const inst of snapshot) {
              inst.localPatchRefCount = Math.max(0, inst.localPatchRefCount - 1);
            }
            // Apply any pending VNodes for the root and snapshot members.
            _flushPendingVNodes([instance, ...snapshot]);
          };
        };
      }
      return hookStates[hookIndex];
    }

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
    if (s == null || typeof s !== 'object') continue;
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
  slots: import('./types').Slot[],
): void {
  for (const slot of slots) {
    // Stop at an inner Provider for the same context – it overrides the outer value.
    if (typeof slot.type === 'function' && _getProviderCtx(slot.type) === ctx) {
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
