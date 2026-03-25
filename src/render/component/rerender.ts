/**
 * rerender.ts — Rerender and resume lifecycle functions.
 *
 * Handles re-rendering mounted components (`executeComponentRerender`,
 * `rerenderInstance`) and resuming paused generators (`resumeInstance`).
 */

import type { Child } from "../../jsx";
import { drive, getContext, type RenderGenerator } from "../driver";
import { isPatchActive } from "../patch-queue";
import { createResolvable } from "../promise";
import { scheduleUpdate } from "../scheduler";
import { RenderCtx } from "../state";
import type { ComponentInstance, RenderContext } from "../types";
import {
  commitOrDefer,
  drainResolvers,
  effectiveCtxMap,
  processHookDescriptors,
  revertPendingEffects,
  runComponentRender,
  validateHookCount,
} from "./lifecycle";

/**
 * Resume a paused generator (e.g. after `useResolve` or `useRender`).
 *
 * Advances the generator past the resolved hook and reconciles the
 * resulting VNode via `commitOrDefer`.
 */
export function* resumeInstance(instance: ComponentInstance): RenderGenerator<void> {
  if (!instance.gen) return;
  if (!instance.endMarker.parentNode) return;

  const ctxMap = effectiveCtxMap(instance);
  const gen = instance.gen;

  const { hookIndex, result } = yield* processHookDescriptors(
    gen,
    gen.next(),
    instance,
    ctxMap,
    instance.resumeHookIndex,
    false,
  );

  instance.resumeHookIndex = hookIndex;
  if (result.done) {
    instance.gen = undefined;
    validateHookCount(instance, hookIndex);
  }

  const vnode: Child = (result.value as Child) ?? null;
  yield* commitOrDefer(instance, vnode);
}

/**
 * Re-render a mounted component: run hooks, commit via `commitOrDefer`.
 *
 * Loops when `pendingRerender` is set (mid-render setState).
 */
export function* executeComponentRerender(
  instance: ComponentInstance,
  rctx?: RenderContext,
): RenderGenerator<void> {
  const resolvedRctx = rctx ?? (yield* getContext(RenderCtx));

  while (true) {
    const { vnode, cancelled } = yield* runComponentRender(instance, resolvedRctx);
    if (cancelled) {
      revertPendingEffects(instance);
      continue;
    }

    yield* commitOrDefer(instance, vnode);
    drainResolvers(instance);

    if (!instance.endMarker.parentNode) return;
    if (instance.pendingRerender) {
      instance.pendingRerender = false;
      continue;
    }
    return;
  }
}

/**
 * Trigger a re-render of this component.
 *
 * If a render is already in progress, queues the rerender for after the
 * current cycle. If a UI patch is active, executes synchronously to
 * collect DOM ops in the same batch. Otherwise, schedules via the
 * priority-aware scheduler.
 */
export function rerenderInstance(instance: ComponentInstance): Promise<void> {
  if (instance.isRendering) {
    instance.pendingRerender = true;
    const { promise, resolve } = createResolvable<void>();
    instance.renderResolvers.push(resolve);
    return promise;
  }
  if (!instance.endMarker.parentNode) return Promise.resolve();
  if (isPatchActive()) {
    drive(effectiveCtxMap(instance), executeComponentRerender(instance));
    return Promise.resolve();
  }
  scheduleUpdate(instance);
  return Promise.resolve();
}
