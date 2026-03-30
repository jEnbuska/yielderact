/**
 * lifecycle.ts — Shared helpers for component rendering.
 *
 * Pure utilities and the hook-processing loop used by initial render,
 * rerender, and resume. No dependency on any specific lifecycle function.
 */

import type { Context } from "../../context";
import type { HookDescriptor } from "../../hooks/descriptors";
import type { Child } from "../../jsx";
import { driveWithContext, getContextMap, type RenderGenerator } from "../driver";
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
  ctx: ReadonlyMap<Context, unknown>,
  startIndex: number,
): RenderGenerator<{
  hookIndex: number;
  result: IteratorResult<unknown, Child>;
}> {
  const { gen } = instance;
  if (!gen) throw new Error("processHookDescriptors called without an active generator");
  let hookIndex = startIndex;
  let result = gen.next();

  while (!result.done && isHookDescriptor(result.value)) {
    const descriptor = result.value as HookDescriptor;
    const hookResult = processOneDescriptor(descriptor, hookIndex++, instance, ctx);
    result = gen.next(hookResult);
  }

  return { hookIndex, result };
}

// ── Commit ───────────────────────────────────────────────────────────────

/**
 * Commit a VNode: reconcile the DOM and flush effects.
 */
export function* commitRender(instance: ComponentInstance, vnode: Child): RenderGenerator<void> {
  const ctx = yield* getContextMap();
  const parent = instance.endMarker.parentNode as HTMLElement;

  instance.slots = yield* driveWithContext(ctx, reconcileSlotsGen(parent, instance, [vnode]));

  flushEffects(instance);
}

// ── Shared render step ───────────────────────────────────────────────────

/**
 * Run hooks on a fresh component generator.
 *
 * Shared setup for `initialComponentRender` and `executeComponentRerender`.
 * Resets instance state, creates the generator, processes hook descriptors,
 * and returns the resulting VNode.
 */
export function* runComponentRender(instance: ComponentInstance): RenderGenerator<Child> {
  const { scheduler } = instance;
  scheduler.renderingInstance = instance;
  instance.pendingEffects.length = 0;
  instance.consumedContexts.clear();

  const ctx = instance.capturedCtx;
  instance.gen = instance.component(instance.props, instance.scheduleRerender);

  const { hookIndex, result } = yield* processHookDescriptors(instance, ctx, 0);

  scheduler.renderingInstance = undefined;
  instance.resumeHookIndex = hookIndex;

  if (result.done) validateHookCount(instance, hookIndex);
  if (result.done) instance.gen = undefined;

  return (result.value as Child) ?? null;
}
