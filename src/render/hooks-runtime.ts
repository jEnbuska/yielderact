/**
 * hooks-runtime.ts — Hook descriptor processing and component lifecycle utilities.
 *
 * This module is the bridge between the generator-based hook API and the
 * renderer. Components yield hook descriptors (tagged objects like
 * `{ type: "$USE_STATE", initialValue }`) from their generator body. The
 * renderer calls `runHooks` which drives the generator in a loop,
 * dispatching each descriptor to `processOneDescriptor` and sending the
 * result back via `gen.next(result)`.
 *
 * Also contains utilities for effect flushing, slot unmounting, descendant
 * collection, and context propagation.
 */

import { _processContext, _resolveCtxValue, type Context, providerContexts } from "../context";
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
  $USE_UI_PATCH,
  HOOK_TYPES,
  type HookDescriptor,
  type HookType,
} from "../hooks/descriptors";
import type { ComponentGenerator } from "../hooks/types";
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
import type { Child } from "../jsx";
import { releasePortalDelegation } from "./delegation";
import { isContextProvider } from "./helpers";
import { _flushPendingVNodes } from "./patch";
import { clearRef } from "./props";
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
function isHookDescriptor(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    HOOK_TYPES.has((value as { type: HookType }).type)
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
 * Calls every cleanup function registered by hooks (`useEffect`,
 * `useResolve`) on every `ComponentInstance` in the subtree. Also removes the
 * instance from `renderCtx.dirtyInstances` so that a pending
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
  if (typeof slot.type === "string" && slot.props.$ref) {
    clearRef(slot.props.$ref);
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
    slot.componentInstance.renderCtx.dirtyInstances.delete(slot.componentInstance);
    // Remove from scheduler queue so pending async callbacks (useResolveRaw
    // promise handlers) don't trigger a zombie rerender.
    for (const [, set] of slot.componentInstance.renderCtx.pendingUpdates) {
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
 * **Called by:** `runHooks` below — once for each hook descriptor yielded
 * during the component's generator body.
 */
function processOneDescriptor(
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
      const rawValue = _resolveCtxValue(ctxMap, descriptor.ctx);
      const state = _processContext(descriptor, prev, rawValue);
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
      const state = _processUIPatch(prev, instance, collectDescendants, _flushPendingVNodes);
      hookStates[hookIndex] = state;
      return state.startPatch;
    }
    default:
      throw new Error(
        `Unknown hook descriptor type: ${String((descriptor as { type: string }).type)}`,
      );
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
 * @param instance - The component's `ComponentInstance`.
 * @param rerender - Function to trigger a rerender (passed to hook descriptors).
 * @param resume   - Function to resume a paused generator (passed to `useRender`).
 * @returns An object with:
 *   - `vnode`: the component's render output (a Child).
 *   - `gen`: the generator to store if it yielded (paused), or `null` if it returned.
 *   - `cancelled`: true if a mid-render state change aborted this render.
 */
export function runHooks(
  gen: ComponentGenerator<Child>,
  instance: ComponentInstance,
  rerender: () => Promise<void>,
  resume: () => void,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): {
  vnode: Child;
  gen?: ComponentGenerator<Child>;
  cancelled: boolean;
} {
  let hookIndex = 0;
  let result = gen.next(undefined);

  while (!result.done && isHookDescriptor(result.value)) {
    const descriptor = result.value as HookDescriptor;
    const value = processOneDescriptor(
      descriptor,
      hookIndex++,
      instance.hookStates,
      instance.cleanupFns,
      instance.pendingEffects,
      rerender,
      resume,
      instance,
      ctxMap,
    );
    // A mid-render state change was queued — abort this stale render so the
    // next iteration of executeRerender picks up the accumulated latest state.
    if (instance.pendingRerender) {
      return { vnode: null, cancelled: true };
    }
    result = gen.next(value);
  }

  // Track where the generator paused so `resume` can continue from
  // the correct hook index when the generator advances past a useRender.
  instance.resumeHookIndex = hookIndex;

  // Validate hook count on generator completion.
  if (result.done) {
    if (instance.finalHookCount !== undefined && hookIndex !== instance.finalHookCount) {
      const componentName = instance.component.name || "Anonymous";
      throw new Error(
        `Hook count mismatch in "${componentName}": ` +
          `previous render completed with ${instance.finalHookCount} hooks, ` +
          `but this render completed with ${hookIndex}. ` +
          `Hooks must be called in the same order and quantity on every render. ` +
          `Do not call hooks inside conditions, loops, or after early returns.`,
      );
    }
    instance.finalHookCount = hookIndex;
  }

  return {
    vnode: (result.value as Child) ?? null,
    gen: result.done ? undefined : gen,
    cancelled: false,
  };
}

/**
 * Continue a paused generator, processing any hook descriptors it yields.
 *
 * When `useRender`'s `resumeCallback` resolves and calls `gen.next()`, the
 * generator may advance past the resolved `useRender` into another hook
 * (`useRender`, `useState`, etc.). This function handles that by looping
 * over yielded descriptors — the same way `runHooks` does — until the
 * generator yields a non-descriptor (VNode) or returns.
 *
 * @param instance - The component instance whose generator to continue.
 * @param rerender - Function to trigger a rerender.
 * @param resume   - Function to resume a paused generator (for nested `useRender`).
 * @returns An object with:
 *   - `vnode`: the yielded/returned VNode (Child).
 *   - `done`: true if the generator returned (no more yields).
 */
export function resumeGenerator(
  instance: ComponentInstance,
  rerender: () => Promise<void>,
  resume: () => void,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
): { vnode: Child; done: boolean } {
  const gen = instance.gen;
  if (!gen) return { vnode: null, done: true };

  let hookIndex = instance.resumeHookIndex;
  let result = gen.next();

  while (!result.done && isHookDescriptor(result.value)) {
    const descriptor = result.value as HookDescriptor;
    const value = processOneDescriptor(
      descriptor,
      hookIndex++,
      instance.hookStates,
      instance.cleanupFns,
      instance.pendingEffects,
      rerender,
      resume,
      instance,
      ctxMap,
    );
    result = gen.next(value);
  }

  instance.resumeHookIndex = hookIndex;

  if (result.done) {
    instance.gen = undefined;
    if (instance.finalHookCount !== undefined && hookIndex !== instance.finalHookCount) {
      const componentName = instance.component.name || "Anonymous";
      throw new Error(
        `Hook count mismatch in "${componentName}": ` +
          `previous render completed with ${instance.finalHookCount} hooks, ` +
          `but this render completed with ${hookIndex}. ` +
          `Hooks must be called in the same order and quantity on every render. ` +
          `Do not call hooks inside conditions, loops, or after early returns.`,
      );
    }
    instance.finalHookCount = hookIndex;
  }

  return {
    vnode: (result.value as Child) ?? null,
    done: result.done === true,
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
 * When a context Provider's `value` prop changes, this function:
 * 1. Updates `capturedCtx` on every descendant `ComponentInstance` so that any
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
    if (isContextProvider(slot) && providerContexts.get(slot.type) === ctx) {
      continue;
    }

    const inst = slot.componentInstance;
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

    // Recurse into HTML-element child slots (componentInstance slots have none).
    if (slot.childSlots.length > 0) {
      propagateContextUpdate(ctx, newValue, slot.childSlots);
    }
  }
}
