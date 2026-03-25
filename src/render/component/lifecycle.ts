/**
 * lifecycle.ts — Shared helpers for component rendering.
 *
 * Pure utilities and the hook-processing loop used by initial render,
 * rerender, and resume. No dependency on any specific lifecycle function.
 */

import { BatchContext, type Context, PriorityContext, withBatch } from "../../context";
import type { HookDescriptor } from "../../hooks/descriptors";
import { $USE_EFFECT, $USE_SET_CONTEXT } from "../../hooks/descriptors";
import type { ComponentGenerator } from "../../hooks/types";
import type { Child } from "../../jsx";
import {
  driveWithContext,
  getContext,
  getContextMap,
  type RenderGenerator,
  setContext,
} from "../driver";
import { flushEffects, isHookDescriptor, processOneDescriptor } from "../hooks-runtime";
import { reconcileSlotsGen } from "../reconciler";
import { RenderCtx } from "../state";
import type { ComponentInstance, RenderContext } from "../types";

// ── Instance helpers ─────────────────────────────────────────────────────

/** Compute the effective context map for a component's children. */
export function effectiveCtxMap(
  instance: ComponentInstance,
): ReadonlyMap<Context<unknown>, unknown> {
  const { $patch } = instance.props;
  return $patch ? withBatch(instance.capturedCtx, $patch) : instance.capturedCtx;
}

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
 * Process hook descriptors from a generator.
 *
 * Shared by initial render, rerender, and resume. The caller advances the
 * generator once and passes the initial `IteratorResult`; this function
 * continues from there until a non-hook value is yielded or the generator
 * returns.
 */
export function* processHookDescriptors(
  gen: ComponentGenerator<Child>,
  initialResult: IteratorResult<unknown, Child>,
  instance: ComponentInstance,
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
  startIndex: number,
  checkCancel: boolean,
): RenderGenerator<{
  hookIndex: number;
  result: IteratorResult<unknown, Child>;
  cancelled: boolean;
}> {
  let hookIndex = startIndex;
  let result = initialResult;
  let cancelled = false;

  while (!result.done && isHookDescriptor(result.value)) {
    const descriptor = result.value as HookDescriptor;
    const hookResult = processOneDescriptor(
      descriptor,
      hookIndex++,
      instance.hookStates,
      instance.cleanupFns,
      instance.pendingEffects,
      instance.rerender,
      instance.resume,
      instance,
      ctxMap,
    );
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
 * Commit or defer a VNode during a UI patch.
 *
 * When a patch is active and the component is not `$patch="live"`, stores
 * the VNode as `pendingVNode` and runs a live-only reconcile pass.
 * Otherwise commits immediately and flushes effects.
 */
export function* commitOrDefer(instance: ComponentInstance, vnode: Child): RenderGenerator<void> {
  const rctx = yield* getContext(RenderCtx);
  const parent = instance.endMarker.parentNode as HTMLElement;
  const batch = yield* getContext(BatchContext);
  const ctxMap = yield* getContextMap();
  const shouldDefer = (rctx.patchDepth > 0 || instance.localPatchRefCount > 0) && batch !== "live";

  if (shouldDefer) {
    instance.pendingVNode = vnode;
    rctx.dirtyInstances.add(instance);
  } else {
    instance.pendingVNode = undefined;
  }

  const prevLiveOnly = rctx.liveOnlyMode;
  if (shouldDefer) rctx.liveOnlyMode = true;
  instance.slots = yield* driveWithContext(
    ctxMap,
    reconcileSlotsGen(parent, instance.slots, [vnode], instance.endMarker),
  );
  rctx.liveOnlyMode = prevLiveOnly;

  if (!shouldDefer) flushEffects(instance);
}

// ── Shared render step ───────────────────────────────────────────────────

/**
 * Run hooks on a fresh component generator, handling priority and cancellation.
 *
 * Shared setup for `initialComponentRender` and `executeComponentRerender`.
 * Resets instance state, creates the generator, processes hook descriptors,
 * and returns the result.
 */
export function* runComponentRender(
  instance: ComponentInstance,
  rctx: RenderContext,
): RenderGenerator<{
  vnode: Child;
  cancelled: boolean;
  componentGen: ComponentGenerator<Child>;
}> {
  instance.isRendering = true;
  instance.gen = undefined;
  instance.pendingEffects.length = 0;
  instance.consumedContexts.clear();
  instance.providedContexts.clear();

  const ctxMap = effectiveCtxMap(instance);
  const componentGen = instance.component(instance.props, instance.rerender);

  const prevRenderingPriority = rctx.renderingPriority;
  rctx.renderingPriority = yield* getContext(PriorityContext);

  const { hookIndex, result, cancelled } = yield* processHookDescriptors(
    componentGen,
    componentGen.next(undefined),
    instance,
    ctxMap,
    0,
    true,
  );

  instance.isRendering = false;
  rctx.renderingPriority = prevRenderingPriority;
  instance.resumeHookIndex = hookIndex;

  if (!cancelled && result.done) validateHookCount(instance, hookIndex);

  const vnode: Child = cancelled ? null : ((result.value as Child) ?? null);
  instance.gen = cancelled || result.done ? undefined : componentGen;

  return { vnode, cancelled, componentGen };
}
