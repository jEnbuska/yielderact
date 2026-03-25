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

import { type Context, processContext, resolveCtx } from "../context";
import {
  $USE_CONTEXT,
  $USE_EFFECT,
  $USE_ID,
  $USE_MEMO,
  $USE_REF,
  $USE_RENDER,
  $USE_RESOLVE,
  $USE_RESOLVE_RAW,
  $USE_SET_CONTEXT,
  $USE_STATE,
  $USE_UI_PATCH,
  HOOK_TYPES,
  type HookDescriptor,
  type HookType,
} from "../hooks/descriptors";
import { depsChanged } from "../hooks/types";
import { _processEffect } from "../hooks/useEffect";
import { _processId } from "../hooks/useId";
import { _processMemo } from "../hooks/useMemo";
import { _processRef } from "../hooks/useRef";
import { _processRender } from "../hooks/useRender";
import type { ResolveRawResult } from "../hooks/useResolve";
import { _processResolve, _processResolveRaw } from "../hooks/useResolve";
import { _createStateSetter, _processState } from "../hooks/useState";
import { _processUIPatch } from "../hooks/useUIPatch";

import { releasePortalDelegation } from "./delegation";
import { flushPendingVNodes } from "./patch";
import { RenderCtx } from "./state";
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
 * Recursively tear down a slot and all its descendants.
 *
 * Calls every cleanup function registered by hooks and removes the
 * instance from `renderCtx.dirtyInstances` and scheduler queues.
 */
export function unmountSlot(slot: Slot): void {
  for (const child of slot.childSlots) {
    unmountSlot(child);
  }
  // Clear ref on HTML element slots
  if (typeof slot.type === "string" && slot.props.ref) {
    slot.props.ref.current = undefined;
  }
  if (slot.componentInstance) {
    for (const child of slot.componentInstance.slots) {
      unmountSlot(child);
    }
    for (const fn of slot.componentInstance.cleanupFns) {
      fn?.();
    }
    // Remove from dirty set so commitUIPatch skips unmounted instances.
    // localPatchRefCount is intentionally left as-is; the local patch commit()
    // checks pendingVNode === undefined and skips accordingly.
    const rctx = resolveCtx(slot.componentInstance.capturedCtx, RenderCtx);
    rctx.dirtyInstances.delete(slot.componentInstance);
    // Remove from scheduler queue so pending async callbacks (useResolveRaw
    // promise handlers) don't trigger a zombie rerender.
    for (const [, set] of rctx.pendingUpdates) {
      set.delete(slot.componentInstance);
    }
  }
  // Portal cleanup: release the ref-counted delegation root.
  if (slot.portalContainer) {
    releasePortalDelegation(slot.portalContainer);
  }
}

/**
 * Collect all descendant `ComponentInstance`s reachable from `instance.slots`
 * via a depth-first traversal.
 *
 * **Called by:** `_processUIPatch` — `useUIPatch`'s `startPatch()` function
 * snapshots all current descendants at the moment the patch begins.
 *
 * @param instance - The root instance whose descendants to collect.
 * @returns A flat array of all descendant `ComponentInstance`s (not including
 *   the root itself).
 */
function collectDescendants(instance: ComponentInstance): ComponentInstance[] {
  const result: ComponentInstance[] = [];
  function walk(slots: Slot[]): void {
    for (const slot of slots) {
      if (slot.componentInstance) {
        result.push(slot.componentInstance);
        walk(slot.componentInstance.slots);
      }
      walk(slot.childSlots);
    }
  }
  walk(instance.slots);
  return result;
}

/** Derive the `ResolveRawResult` from the current hook state. */
function _deriveResolveRawResult(s: HookState | undefined): ResolveRawResult<unknown> {
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
  hookStates: HookState[],
  cleanupFns: ((() => void) | undefined)[],
  pendingEffects: Array<{
    hookIndex: number;
    fn: (signal: AbortSignal) => (() => void) | undefined;
    controller: AbortController;
  }>,
  rerender: () => Promise<void>,
  resume: () => void,
  instance: ComponentInstance,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): unknown {
  switch (descriptor.type) {
    case $USE_STATE: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_STATE, instance);
      const state = _processState(descriptor, prev);
      hookStates[hookIndex] = state;
      return [state.value, _createStateSetter(state, rerender)];
    }
    case $USE_REF: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_REF, instance);
      const state = _processRef(descriptor, prev);
      hookStates[hookIndex] = state;
      return state;
    }
    case $USE_ID: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_ID, instance);
      const state = _processId(prev);
      hookStates[hookIndex] = state;
      return state.id;
    }
    case $USE_MEMO: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_MEMO, instance);
      const state = _processMemo(descriptor, prev);
      hookStates[hookIndex] = state;
      return state.value;
    }
    case $USE_EFFECT: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_EFFECT, instance);
      const { state, isNew } = _processEffect(descriptor, prev);
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
      instance.consumedContexts.add(descriptor.ctx);
      const rawValue = resolveCtx(ctxMap, descriptor.ctx);
      const state = processContext(descriptor, prev, rawValue);
      hookStates[hookIndex] = state;
      return state.lastResult;
    }
    case $USE_RESOLVE_RAW: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_RESOLVE_RAW, instance);
      const { state, isNew } = _processResolveRaw(descriptor, prev);
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
              void rerender();
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
              void rerender();
            }
          },
        );
      }
      return _deriveResolveRawResult(hookStates[hookIndex]);
    }
    case $USE_RESOLVE: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_RESOLVE, instance);
      const { state, isNew } = _processResolve(descriptor, prev);
      hookStates[hookIndex] = state;
      if (isNew) {
        cleanupFns[hookIndex] = () => state.controller.abort();
      }
      return state.promise;
    }
    case $USE_RENDER: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_RENDER, instance);
      const state = _processRender(descriptor, prev, hookStates, hookIndex, resume);
      hookStates[hookIndex] = state;
      return { slot: state, resumeCallback: state.resumeCallback };
    }
    case $USE_UI_PATCH: {
      const prev = getTypedPrev(hookStates, hookIndex, $USE_UI_PATCH, instance);
      const state = _processUIPatch(prev, instance, collectDescendants, flushPendingVNodes);
      hookStates[hookIndex] = state;
      return state.startPatch;
    }
    case $USE_SET_CONTEXT: {
      const prevValue = resolveCtx(instance.capturedCtx, descriptor.ctx);
      const newCtxMap = new Map(instance.capturedCtx);
      newCtxMap.set(descriptor.ctx, descriptor.value);
      instance.capturedCtx = newCtxMap;
      instance.providedContexts.add(descriptor.ctx);
      if (!Object.is(prevValue, descriptor.value)) {
        propagateContextUpdate(descriptor.ctx, descriptor.value, instance.slots);
      }
      return undefined;
    }
    default:
      throw new Error(
        `Unknown hook descriptor type: ${String((descriptor as { type: string }).type)}`,
      );
  }
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
function _hasStableSelectors(
  inst: ComponentInstance,
  ctx: Context<unknown>,
  newValue: unknown,
): boolean {
  for (const s of inst.hookStates) {
    if (s === undefined || s.kind !== $USE_CONTEXT) continue;
    if (s.ctx !== ctx) continue;
    if (!s.selector) return false;
    const newDeps = s.selector(newValue);
    if (depsChanged(s.lastDeps, newDeps)) return false;
  }
  return true;
}

/**
 * Walk all descendant slots and propagate a context value change.
 *
 * Updates `capturedCtx` on descendants and re-renders consumers whose
 * selectors are not stable under the new value. Stops at inner Providers
 * for the same context.
 */
export function propagateContextUpdate(
  ctx: Context<unknown>,
  newValue: unknown,
  slots: Slot[],
): void {
  for (const slot of slots) {
    const inst = slot.componentInstance;
    // Stop at an inner Provider for the same context — it overrides the outer value.
    if (inst?.providedContexts?.has(ctx)) {
      continue;
    }
    if (inst) {
      // Keep capturedCtx current so future self-triggered re-renders use the
      // new value even if this component doesn't consume the changed context.
      const updated = new Map(inst.capturedCtx);
      updated.set(ctx, newValue);
      inst.capturedCtx = updated;

      if (inst.consumedContexts.has(ctx) && !_hasStableSelectors(inst, ctx, newValue)) {
        // Re-render this consumer.  rerender() calls reconcileSlots on its
        // children with the updated capturedCtx, so we don't recurse further.
        void inst.rerender();
      } else {
        // This component doesn't consume the context (or all its selectors
        // are stable), but its rendered children might.  Recurse into its
        // internal slots.
        propagateContextUpdate(ctx, newValue, inst.slots);
      }
    }

    // Recurse into HTML-element child slots (componentInstance slots have none).
    if (slot.childSlots.length > 0) {
      propagateContextUpdate(ctx, newValue, slot.childSlots);
    }
  }
}
