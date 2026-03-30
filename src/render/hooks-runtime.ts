/**
 * hooks-runtime.ts — Hook descriptor processing and lifecycle utilities.
 *
 * Components yield hook descriptors from their generator body.
 * `executeRerender` in mount.ts drives the generator, dispatching each
 * descriptor to `processOneDescriptor` and sending the result back.
 *
 * Also contains effect flushing, slot unmounting, descendant collection,
 * and context propagation.
 */

import { type Context, type ProviderHandle, processContext, resolveCtx } from "../context";
import {
  $USE_CONTEXT,
  $USE_EFFECT,
  $USE_ID,
  $USE_MEMO,
  $USE_REF,
  $USE_RENDER,
  $USE_RESOLVE,
  $USE_RESOLVE_RAW,
  $USE_STATE,
  HOOK_TYPES,
  type HookDescriptor,
  type HookType,
} from "../hooks/descriptors";
import { depsChanged } from "../hooks/types";
import { processEffect } from "../hooks/useEffect";
import { processId } from "../hooks/useId";
import { processMemo } from "../hooks/useMemo";
import { processRef } from "../hooks/useRef";
import { processRender } from "../hooks/useRender";
import type { ResolveRawResult } from "../hooks/useResolve";
import { processResolve, processResolveRaw } from "../hooks/useResolve";
import { createStateSetter, processState } from "../hooks/useState";
import { releasePortalDelegation } from "./delegation";
import type { ComponentInstance, HookState, Slot } from "./types";

/**
 * Extract and validate the previous hook state at `hookIndex`.
 *
 * Returns the typed previous state if it exists and matches `expectedKind`,
 * or `undefined` if first render. Throws on kind mismatch (hook order violation).
 */
function getTypedPrev<K extends HookState["kind"]>(
  hookStates: HookState[],
  hookIndex: number,
  expectedKind: K,
  instance: ComponentInstance,
): Extract<HookState, { kind: K }> | undefined {
  const prev = hookStates[hookIndex];
  if (prev === undefined) return undefined;
  if (prev.kind !== expectedKind) {
    const componentName = instance.component.name || "Anonymous";
    throw new Error(
      `Hook order mismatch in "${componentName}" at index ${hookIndex}: ` +
        `expected ${prev.kind} (from previous render) but got ${expectedKind}. ` +
        `Hooks must be called in the same order on every render. ` +
        `Do not call hooks inside conditions, loops, or after early returns.`,
    );
  }
  return prev as Extract<HookState, { kind: K }>;
}

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
    HOOK_TYPES.has((value as { type: HookType }).type)
  );
}

/**
 * Run any `useEffect` callbacks that were queued during the last render pass.
 *
 * Effects are deferred until after the DOM is updated. Only fires when
 * `instance.gen` is undefined (generator has fully returned, not paused).
 */
export function flushEffects(instance: ComponentInstance): void {
  if (instance.gen) return;
  for (const { hookIndex, fn, controller } of instance.pendingEffects) {
    const cleanup = fn(controller.signal);
    const state = instance.hookStates[hookIndex];
    if (state !== undefined && state.kind === $USE_EFFECT) {
      state.cleanup = cleanup;
    }
  }
  instance.pendingEffects.length = 0;
}

/**
 * Resolve all pending setState promises on this instance.
 *
 * Called after the scheduler commits work. Each useState hook slot
 * may have a `pendingResolve` from the latest setState call. Resolving
 * it fulfills the promise returned by the setter.
 */
export function drainStateResolvers(instance: ComponentInstance): void {
  for (const state of instance.hookStates) {
    if (state !== undefined && state.kind === $USE_STATE) {
      state.pendingResolve();
    }
  }
}

/**
 * Recursively tear down a slot and all its descendants.
 *
 * Calls every cleanup function registered by hooks and removes the
 * instance from the scheduler queue.
 */
export function unmountSlot(slot: Slot): void {
  for (const child of slot.childSlots) {
    unmountSlot(child);
  }
  // Clear ref on HTML element slots
  if (typeof slot.type === "string" && slot.props.ref) {
    slot.props.ref.current = undefined;
  }
  if (slot.instance) {
    for (const child of slot.instance.slots) {
      unmountSlot(child);
    }
    for (const fn of slot.instance.cleanupFns) {
      fn?.();
    }
    // Remove from scheduler queue so pending async callbacks (useResolveRaw
    // promise handlers) don't trigger a zombie rerender.
    slot.instance.scheduler.removePending(slot.instance);
  }
  // Portal cleanup: release the ref-counted delegation root.
  if (slot.portalContainer) {
    releasePortalDelegation(slot.portalContainer);
  }
}

/** Derive the `ResolveRawResult` from the current hook state. */
function deriveResolveRawResult(s: HookState | undefined): ResolveRawResult<unknown> {
  if (s !== undefined && s.kind === $USE_RESOLVE_RAW) {
    if (s.status === "resolved") return { data: s.data, loading: false, error: undefined };
    if (s.status === "rejected") return { data: undefined, loading: false, error: s.error };
  }
  return { data: undefined, loading: true, error: undefined };
}

/**
 * Process a single hook descriptor and return the value to send back to
 * the generator via `gen.next(value)`.
 *
 * This is the central dispatch function for all hooks. Each hook type
 * yields a descriptor object with a `type` string constant and associated data.
 * Each hook's `_process` function is a pure state transition that receives the
 * descriptor and the typed previous state. This function handles type validation,
 * state writes, and side-effect orchestration (cleanup, pending effects, promise handlers).
 *
 * Called by `runHooks` — once per hook descriptor yielded during the
 * component's generator body.
 */
export function processOneDescriptor(
  descriptor: HookDescriptor,
  hookIndex: number,
  instance: ComponentInstance,
  // biome-ignore lint/suspicious/noExplicitAny: Context is contravariant in T; `any` avoids variance issues.
  ctx: ReadonlyMap<Context<any>, unknown>,
): unknown {
  const { hookStates, cleanupFns, pendingEffects, scheduleRerender, resume } = instance;
  switch (descriptor.type) {
    case $USE_STATE: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_STATE, instance);
      const state = processState(descriptor, prev);
      hookStates[hookIndex] = state;
      return [state.value, createStateSetter(state, scheduleRerender)];
    }
    case $USE_REF: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_REF, instance);
      const state = processRef(descriptor, prev);
      hookStates[hookIndex] = state;
      return state;
    }
    case $USE_ID: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_ID, instance);
      const state = processId(prev);
      hookStates[hookIndex] = state;
      return state.id;
    }
    case $USE_MEMO: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_MEMO, instance);
      const state = processMemo(descriptor, prev);
      hookStates[hookIndex] = state;
      return state.value;
    }
    case $USE_EFFECT: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_EFFECT, instance);
      const { state, isNew } = processEffect(descriptor, prev);
      hookStates[hookIndex] = state;
      if (isNew) {
        pendingEffects.push({ hookIndex, fn: descriptor.fn, controller: state.controller });
        cleanupFns[hookIndex] = () => {
          state.controller.abort();
          state.cleanup?.();
        };
      }
      return undefined;
    }
    case $USE_CONTEXT: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_CONTEXT, instance);
      const rawValue = resolveCtx(ctx, descriptor.ctx);
      const state = processContext(descriptor, prev, rawValue);
      hookStates[hookIndex] = state;

      // Subscribe to the nearest provider's handle on first render.
      // The handle is stored in the context map by mountProvider.
      if (!prev) {
        const handle = ctx.get(descriptor.ctx) as ProviderHandle | undefined;
        if (handle) {
          const { selector } = state;
          let lastDeps = state.lastDeps;
          const unsubscribe = handle.subscribe((newValue: unknown) => {
            if (!selector) {
              void instance.scheduleRerender();
              return;
            }
            const newDeps = selector(newValue);
            if (depsChanged(lastDeps, newDeps)) {
              lastDeps = newDeps;
              void instance.scheduleRerender();
            }
          });
          cleanupFns[hookIndex] = unsubscribe;
        }
      }
      return state.lastResult;
    }
    case $USE_RESOLVE_RAW: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_RESOLVE_RAW, instance);
      const { state, isNew } = processResolveRaw(descriptor, prev);
      hookStates[hookIndex] = state;
      if (isNew) {
        descriptor.promise.then(
          (data) => {
            if (hookStates[hookIndex] === state) {
              hookStates[hookIndex] = {
                kind: $USE_RESOLVE_RAW,
                promise: descriptor.promise,
                status: "resolved",
                data,
              };
              void scheduleRerender();
            }
          },
          (error: unknown) => {
            if (hookStates[hookIndex] === state) {
              hookStates[hookIndex] = {
                kind: $USE_RESOLVE_RAW,
                promise: descriptor.promise,
                status: "rejected",
                error,
              };
              void scheduleRerender();
            }
          },
        );
      }
      return deriveResolveRawResult(hookStates[hookIndex]);
    }
    case $USE_RESOLVE: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_RESOLVE, instance);
      const { state, isNew } = processResolve(descriptor, prev);
      hookStates[hookIndex] = state;
      if (isNew) {
        cleanupFns[hookIndex] = () => state.controller.abort();
      }
      return state.promise;
    }
    case $USE_RENDER: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_RENDER, instance);
      const state = processRender(descriptor, prev, hookStates, hookIndex, resume);
      hookStates[hookIndex] = state;
      return { slot: state, resumeCallback: state.resumeCallback };
    }
    default:
      throw new Error(
        `Unknown hook descriptor type: ${String((descriptor as { type: string }).type)}`,
      );
  }
}

