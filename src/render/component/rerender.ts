/**
 * rerender.ts — Rerender and resume lifecycle functions.
 *
 * Handles re-rendering mounted components (`executeComponentRerender`,
 * `rerenderInstance`) and resuming paused generators (`resumeInstance`).
 */

import type { Child } from "../../jsx";
import type { RenderGenerator } from "../driver";
import { createResolvable } from "../promise";
import { scheduleUpdate } from "../scheduler";
import type { ComponentInstance } from "../types";
import {
  commitRender,
  drainResolvers,
  processHookDescriptors,
  revertPendingEffects,
  runComponentRender,
  validateHookCount,
} from "./lifecycle";

/**
 * Resume a paused generator (e.g. after `useResolve` or `useRender`).
 *
 * Advances the generator past the resolved hook and reconciles the
 * resulting VNode via `commitRender`.
 */
export function* resumeInstance(instance: ComponentInstance): RenderGenerator<void> {
  if (!instance.gen) return;
  if (!instance.endMarker.parentNode) return;

  const ctx = instance.capturedCtx;

  const { hookIndex, result } = yield* processHookDescriptors(
    instance,
    ctx,
    instance.resumeHookIndex,
    false,
  );

  instance.resumeHookIndex = hookIndex;
  if (result.done) {
    instance.gen = undefined;
    validateHookCount(instance, hookIndex);
  }

  const vnode: Child = (result.value as Child) ?? null;
  yield* commitRender(instance, vnode);
}

/**
 * Re-render a mounted component: run hooks, commit via `commitRender`.
 *
 * Loops when `pendingRerender` is set (mid-render setState).
 */
export function* executeComponentRerender(instance: ComponentInstance): RenderGenerator<void> {
  while (true) {
    const { vnode, cancelled } = yield* runComponentRender(instance);
    if (cancelled) {
      revertPendingEffects(instance);
      continue;
    }

    yield* commitRender(instance, vnode);
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
 * current cycle. Otherwise, schedules via the scheduler.
 */
export function rerenderInstance(instance: ComponentInstance): Promise<void> {
  if (instance.isRendering) {
    instance.pendingRerender = true;
    const { promise, resolve } = createResolvable<void>();
    instance.renderResolvers.push(resolve);
    return promise;
  }
  if (!instance.endMarker.parentNode) return Promise.resolve();
  scheduleUpdate(instance);
  return Promise.resolve();
}
