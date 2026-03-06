import { type Child } from '../jsx';
import { _getCtxMap, USE_CONTEXT, type Context } from '../context';
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
  for (const { hookIndex, fn } of instance.pendingEffects) {
    const cleanup = fn();
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
 * Process a single hook descriptor and return the value to send back to the
 * generator via `gen.next(value)`.
 */
export function processOneDescriptor(
  descriptor: { type: symbol; [key: string]: unknown },
  hookIndex: number,
  hookStates: unknown[],
  cleanupFns: ((() => void) | undefined)[],
  pendingEffects: Array<{ hookIndex: number; fn: () => (() => void) | void }>,
  rerender: () => void,
  resume: () => void,
  instance: GenInstance,
): unknown {
  switch (descriptor.type) {
    case USE_STATE: {
      if (!(hookIndex in hookStates)) {
        const init = descriptor['initialValue'];
        hookStates[hookIndex] = typeof init === 'function' ? (init as () => unknown)() : init;
      }
      const setter = (newValue: unknown): void => {
        hookStates[hookIndex] =
          typeof newValue === 'function'
            ? (newValue as (prev: unknown) => unknown)(hookStates[hookIndex])
            : newValue;
        rerender();
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
      const ctxMap = _getCtxMap();
      const value = ctxMap.get(ctx);
      return value !== undefined ? value : ctx._defaultValue;
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
      type EffectState = { deps: unknown[]; cleanup: (() => void) | void };
      const fn = descriptor['fn'] as () => (() => void) | void;
      const deps = descriptor['deps'] as unknown[];
      const existing = hookStates[hookIndex] as EffectState | undefined;

      if (!existing || depsChanged(existing.deps, deps)) {
        // Run cleanup of the previous effect synchronously before the new one.
        existing?.cleanup?.();
        // Store updated deps; cleanup will be filled in by flushEffects after DOM update.
        hookStates[hookIndex] = { deps, cleanup: undefined } satisfies EffectState;
        // Queue the effect to run after reconciliation.
        pendingEffects.push({ hookIndex, fn });
        // Register unmount cleanup that reads the stored cleanup from hookStates.
        cleanupFns[hookIndex] = () => {
          (hookStates[hookIndex] as EffectState).cleanup?.();
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
  rerender: () => void,
  resume: () => void,
): {
  vnode: Child;
  gen: Generator<unknown, Child, unknown> | null;
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
    result = gen.next(value);
  }

  return {
    vnode: (result.value as import('../jsx').Child) ?? null,
    gen: result.done ? null : gen,
  };
}
