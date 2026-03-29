/**
 * mount-component.ts — Component instance creation and initial render.
 *
 * Creates a `ComponentInstance` with bound lifecycle closures and runs
 * the initial render, committing output to a DocumentFragment.
 *
 * Only used during initial mount. Rerenders go through
 * `component/rerender.ts` via the scheduler.
 */

import { resolveCtx } from "../../context";
import type { Component, InternalProps } from "../../jsx";
import { runComponentRender } from "../component/lifecycle";
import { executeComponentRerender, rerenderInstance, resumeInstance } from "../component/rerender";
import {
  type CtxMap,
  driveWithContext,
  getContextMap,
  type RenderGenerator,
  setContext,
} from "../driver";
import { flushEffects } from "../hooks-runtime";
import { ParentSlotIdCtx, SchedulerCtx } from "../scheduler";
import type { ComponentInstance } from "../types";
import { buildInitialSlotsGen } from "./build-slots";

/**
 * Create a `ComponentInstance` with bound lifecycle closures.
 * Pure synchronous work — no yields.
 */
function createComponentInstance(
  component: Component,
  props: InternalProps,
  ctx: CtxMap,
  slotId: number[],
): ComponentInstance {
  const instance: ComponentInstance = {
    component,
    slotId,
    props,
    endMarker: document.createComment(""),
    capturedCtx: ctx,
    slots: [],
    hookStates: [],
    cleanupFns: [],
    pendingEffects: [],
    mounted: false,
    resumeHookIndex: 0,
    consumedContexts: new Set(),
    providedContexts: new Set(),
    resume: () => {
      const scheduler = resolveCtx(instance.capturedCtx, SchedulerCtx);
      scheduler.submit(instance, resumeInstance(instance));
    },
    executeRerender: () => {
      const scheduler = resolveCtx(instance.capturedCtx, SchedulerCtx);
      scheduler.submit(instance, executeComponentRerender(instance));
    },
    scheduleRerender: () => rerenderInstance(instance),
  };

  return instance;
}

/**
 * Mount a component: create the instance and run the initial render.
 *
 * Returns a `DocumentFragment` containing the output nodes and the
 * instance for slot tracking.
 */
export function* mountComponent(
  component: Component,
  props: InternalProps,
  index: number,
): RenderGenerator<{ fragment: DocumentFragment; instance: ComponentInstance }> {
  const ctx = yield* getContextMap();
  const parentSlotId = (ctx.get(ParentSlotIdCtx) as number[] | undefined) ?? [];
  const slotId = [...parentSlotId, index];

  const instance = createComponentInstance(component, props, ctx, slotId);

  // Set this component's slotId as the parentSlotId for its children
  yield* setContext(ParentSlotIdCtx, () => slotId);

  const vnode = yield* runComponentRender(instance);

  const fragment = document.createDocumentFragment();
  fragment.appendChild(instance.endMarker);
  instance.slots = yield* driveWithContext(
    yield* getContextMap(),
    buildInitialSlotsGen(fragment, [vnode], instance.endMarker),
  );
  instance.mounted = true;
  flushEffects(instance);

  return { fragment, instance };
}
