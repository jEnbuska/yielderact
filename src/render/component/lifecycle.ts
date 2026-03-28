/**
 * lifecycle.ts — Shared helpers for component rendering.
 *
 * Pure utilities and the hook-processing loop used by initial render,
 * rerender, and resume. No dependency on any specific lifecycle function.
 */

import type { Context } from "../../context";
import type { HookDescriptor } from "../../hooks/descriptors";
import { $USE_EFFECT, $USE_SET_CONTEXT } from "../../hooks/descriptors";
import type { Child } from "../../jsx";
import { driveWithContext, getContextMap, type RenderGenerator, setContext } from "../driver";
import { flushEffects, isHookDescriptor, processOneDescriptor } from "../hooks-runtime";
import { reconcileSlotsGen } from "../reconciler";
import type { ComponentInstance } from "../types";

// ── Instance helpers ─────────────────────────────────────────────────────

/** Validate that the hook count matches across renders. */
export function validateHookCount(instance: ComponentInstance, hookIndex: number): void {
  if (instance.finalHookCount !== undefined && hookIndex !== instance.finalHookCount) {
    const name = instance.component.name || "Anonymous";
    throw new Error(
      `Hook count mismatch in "${name}": previous ${instance.finalHookCount}, now ${hookIndex}.`,
    );
  }
  instance.finalHookCount = hookIndex;
}

/** Revert pending effect deps after a mid-render cancellation. */
export function revertPendingEffects(instance: ComponentInstance): void {
  for (const pe of instance.pendingEffects) {
    const state = instance.hookStates[pe.hookIndex];
    if (state !== undefined && state.kind === $USE_EFFECT) {
      state.deps = [];
    }
  }
  instance.pendingRerender = false;
}

/** Drain and resolve all queued setState promise resolvers. */
export function drainResolvers(instance: ComponentInstance): void {
  const resolvers = instance.renderResolvers.splice(0);
  for (const resolve of resolvers) resolve();
}

// ── Hook processing ──────────────────────────────────────────────────────

/**
 * Process hook descriptors from the instance's generator.
 *
 * Shared by initial render, rerender, and resume. Advances `instance.gen`,
 * processing hook descriptors until a non-hook value is yielded or the
 * generator returns.
 */
export function* processHookDescriptors(
  instance: ComponentInstance,
  ctx: ReadonlyMap<Context<unknown>, unknown>,
  startIndex: number,
  checkCancel: boolean,
): RenderGenerator<{
  hookIndex: number;
  result: IteratorResult<unknown, Child>;
  cancelled: boolean;
}> {
  const { gen } = instance;
  if (!gen) throw new Error("processHookDescriptors called without an active generator");
  let hookIndex = startIndex;
  let result = gen.next();
  let cancelled = false;

  while (!result.done && isHookDescriptor(result.value)) {
    const descriptor = result.value as HookDescriptor;
    const hookResult = processOneDescriptor(descriptor, hookIndex++, instance, ctx);
    if (descriptor.type === $USE_SET_CONTEXT) {
      const { ctx, value } = descriptor as { ctx: Context<unknown>; value: unknown };
      yield* setContext(ctx, () => value);
    }
    if (checkCancel && instance.pendingRerender) {
      cancelled = true;
      break;
    }
    result = gen.next(hookResult);
  }

  return { hookIndex, result, cancelled };
}

// ── Commit ───────────────────────────────────────────────────────────────

/**
 * Commit a VNode: reconcile the DOM and flush effects.
 */
export function* commitRender(instance: ComponentInstance, vnode: Child): RenderGenerator<void> {
  const ctx = yield* getContextMap();
  const parent = instance.endMarker.parentNode as HTMLElement;

  instance.slots = yield* driveWithContext(
    ctx,
    reconcileSlotsGen(parent, instance.slots, [vnode], instance.endMarker),
  );

  flushEffects(instance);
}

// ── Shared render step ───────────────────────────────────────────────────

/**
 * Run hooks on a fresh component generator, handling cancellation.
 *
 * Shared setup for `initialComponentRender` and `executeComponentRerender`.
 * Resets instance state, creates the generator, processes hook descriptors,
 * and returns the result.
 */
export function* runComponentRender(instance: ComponentInstance): RenderGenerator<{
  vnode: Child;
  cancelled: boolean;
}> {
  instance.isRendering = true;
  instance.pendingEffects.length = 0;
  instance.consumedContexts.clear();
  instance.providedContexts.clear();

  const ctx = instance.capturedCtx;
  instance.gen = instance.component(instance.props, instance.rerender);

  const { hookIndex, result, cancelled } = yield* processHookDescriptors(instance, ctx, 0, true);

  instance.isRendering = false;
  instance.resumeHookIndex = hookIndex;

  if (!cancelled && result.done) validateHookCount(instance, hookIndex);

  const vnode: Child = cancelled ? null : ((result.value as Child) ?? null);
  if (cancelled || result.done) instance.gen = undefined;

  return { vnode, cancelled };
}
