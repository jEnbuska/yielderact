import { type Child } from '../jsx';
import {
  _getCtxMap,
  USE_CONTEXT,
  type Context,
  _getProviderCtx,
  _resolveCtxValue,
} from '../context';
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

/** Set of all known hook descriptor type symbols for fast membership test. */
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

/** Returns true when a yielded value is a hook descriptor (not a VNode/Child). */
export function isHookDescriptor(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    HOOK_SYMBOLS.has((value as { type: symbol }).type)
  );
}

/**
 * Run any effects that were queued during the last render pass.
 * Only fires when the generator has fully returned (gen === null), meaning the
 * component is not mid-interaction (e.g. waiting inside useRender).
 * Cleanup from the previous effect at each slot is stored in hookStates so
 * that unmountSlot can call it via cleanupFns.
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
 * Recursively call cleanup functions for a slot and all its descendants.
 * Called when a slot is about to be replaced or removed from the DOM.
 */
export function unmountSlot(slot: Slot): void {
  for (const child of slot.childSlots) {
    unmountSlot(child);
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
 * Collect all descendant `GenInstance`s reachable from `instance.slots` via a
 * depth-first traversal.  Used by `useUIPatch` to snapshot the subtree at the
 * moment `startPatch()` is called.
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
 * Collect all descendant `GenInstance`s reachable from a `Slot[]` (rather
 * than from a `GenInstance`).  Used by the reconciler to scan Provider
 * children for context consumers when evaluating selective rerenders.
 */
export function collectDescendantsFromSlots(slots: Slot[]): GenInstance[] {
  const result: GenInstance[] = [];
  function walk(s: Slot[]): void {
    for (const slot of s) {
      if (slot.genInstance) {
        result.push(slot.genInstance);
        walk(slot.genInstance.slots);
      }
      walk(slot.childSlots);
    }
  }
  walk(slots);
  return result;
}

/**
 * Persistent hook state stored for a `useContext` call that has a selector.
 * Holds the last computed deps and result so that re-renders can be skipped
 * when the subscribed slice of the context value has not changed.
 *
 * @internal
 */
export type UseContextState = {
  ctx: Context<unknown>;
  selector: ((ctx: unknown) => unknown[]) | undefined;
  transform: ((...args: unknown[]) => unknown) | undefined;
  lastDeps: unknown[] | undefined;
  lastResult: unknown;
};

/**
 * Process a single hook descriptor and return the value to send back to the
 * generator via `gen.next(value)`.
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

    case USE_REF: {
      if (!(hookIndex in hookStates)) {
        hookStates[hookIndex] = { current: descriptor['initialValue'] };
      }
      return hookStates[hookIndex];
    }

    case USE_ID: {
      if (!(hookIndex in hookStates)) {
        hookStates[hookIndex] = `:r${renderState.idCounter++}:`;
      }
      return hookStates[hookIndex];
    }

    case USE_MEMO: {
      const fn = descriptor['fn'] as (...args: unknown[]) => unknown;
      const deps = descriptor['deps'] as unknown[];
      const existing = hookStates[hookIndex] as { value: unknown; deps: unknown[] } | undefined;
      if (!existing || depsChanged(existing.deps, deps)) {
        hookStates[hookIndex] = { value: fn(...deps), deps };
      }
      return (hookStates[hookIndex] as { value: unknown }).value;
    }

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

    case USE_UI_PATCH: {
      // Return a stable `startPatch` function that, when called, snapshots the
      // calling component's current descendant instances and defers their DOM
      // writes until the returned `commit` function is called.
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
 * Runs `gen.next()` in a loop: whenever the generator yields a hook descriptor
 * the descriptor is processed and the result is sent back via `gen.next(result)`.
 * The loop exits when the generator either returns (done) or yields a real VNode
 * (render output that the reconciler should display).
 *
 * Returns the VNode to reconcile and the generator to store (null if done).
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
 * Walk all descendant slots and propagate a context value change:
 *
 *  - Updates `capturedCtx` on every generator instance found so that any
 *    future self-triggered re-render uses the new value.
 *  - Immediately re-renders instances that **consumed** the changed context in
 *    their last render (tracked via `consumedContexts`).
 *  - Stops recursing into subtrees guarded by an inner Provider for the *same*
 *    context – those subtrees override the outer value and must not be touched.
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
