/**
 * rerender.ts — Rerender and resume lifecycle functions.
 *
 * Handles re-rendering mounted components (`executeComponentRerender`,
 * `rerenderInstance`) and resuming paused generators (`resumeInstance`).
 */

import { resolveCtx } from "../../context";
import type { Child } from "../../jsx";
import type { RenderGenerator } from "../driver";
import { SetStateDuringRenderError } from "../errors";
import { SchedulerCtx } from "../scheduler";
import type { ComponentInstance } from "../types";
import {
  commitRender,
  processHookDescriptors,
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
 */
export function* executeComponentRerender(instance: ComponentInstance): RenderGenerator<void> {
  const vnode = yield* runComponentRender(instance);
  yield* commitRender(instance, vnode);
}

/**
 * Trigger a re-render of this component.
 *
 * Throws if called during any component's render phase.
 * Otherwise, schedules via the scheduler.
 */
export function rerenderInstance(instance: ComponentInstance): Promise<void> {
  const scheduler = resolveCtx(instance.capturedCtx, SchedulerCtx);
  const { renderingInstance } = scheduler;
  if (renderingInstance) {
    throw new SetStateDuringRenderError(renderingInstance.component.name, instance.component.name);
  }
  if (!instance.endMarker.parentNode) return Promise.resolve();
  scheduler.scheduleUpdate(instance);
  return Promise.resolve();
}
