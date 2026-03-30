/**
 * mount-component.ts — Component instance creation and initial render.
 *
 * Creates a `ComponentInstance` with bound lifecycle closures and runs
 * the initial render, committing output to a DocumentFragment.
 *
 * Only used during initial mount. Rerenders go through
 * `component/rerender.ts` via the scheduler.
 */

import type { Context, ProviderHandle } from "../../context";
import type { Child, Component, InternalProps } from "../../jsx";
import { runComponentRender } from "../component/lifecycle";
import { isHookDescriptor, processOneDescriptor } from "../hooks-runtime";
import { executeComponentRerender, rerenderInstance, resumeInstance } from "../component/rerender";
import { type CtxMap, driveWithContext, getContextMap, type RenderGenerator } from "../driver";
import { flushEffects } from "../hooks-runtime";
import type { Scheduler } from "../scheduler";
import type { ComponentInstance } from "../types";
import { buildInitialSlotsGen } from "./build-slots";

/**
 * Create a `ComponentInstance` with bound lifecycle closures.
 * Pure synchronous work — no yields.
 */
function createComponentInstance(
  component: Component | Context,
  props: InternalProps,
  ctx: CtxMap,
  slotId: number[],
  scheduler: Scheduler,
): ComponentInstance {
  const instance: ComponentInstance = {
    component,
    scheduler,
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
    resume: () => {
      instance.scheduler.submit(instance, resumeInstance(instance));
    },
    executeRerender: () => {
      instance.scheduler.submit(instance, executeComponentRerender(instance));
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
  scheduler: Scheduler,
  parentSlotId: number[] = [],
): RenderGenerator<{ fragment: DocumentFragment; instance: ComponentInstance }> {
  const ctx = yield* getContextMap();
  const slotId = [...parentSlotId, index];

  const instance = createComponentInstance(component, props, ctx, slotId, scheduler);

  const vnode = yield* runComponentRender(instance);

  const fragment = document.createDocumentFragment();
  fragment.appendChild(instance.endMarker);
  instance.slots = yield* driveWithContext(
    yield* getContextMap(),
    buildInitialSlotsGen(fragment, [vnode], instance.endMarker, scheduler, instance.slotId),
  );
  instance.mounted = true;
  flushEffects(instance);

  return { fragment, instance };
}

/**
 * Mount a context provider: run its generator to get { ref, subscribe },
 * store the handle in the context map, then render children.
 */
export function* mountProvider(
  context: Context,
  props: InternalProps,
  index: number,
  scheduler: Scheduler,
  parentSlotId: number[] = [],
): RenderGenerator<{ fragment: DocumentFragment; instance: ComponentInstance; handle: ProviderHandle }> {
  const ctx = yield* getContextMap();
  const slotId = [...parentSlotId, index];
  const instance = createComponentInstance(context, props, ctx, slotId, scheduler);

  // Drive the provider generator directly — providers are internal,
  // don't need gen tracking or hook count validation.
  const gen = context(props, instance.scheduleRerender);
  let hookIndex = 0;
  let result = gen.next();
  while (!result.done && isHookDescriptor(result.value)) {
    const hookResult = processOneDescriptor(result.value, hookIndex++, instance, ctx);
    result = gen.next(hookResult);
  }
  const handle = result.value as ProviderHandle;

  // Create a new context map with the provider handle for descendants
  const childCtx = new Map(ctx);
  childCtx.set(context, handle);

  const children = (props.children ?? []) as Child[];
  const fragment = document.createDocumentFragment();
  fragment.appendChild(instance.endMarker);
  instance.slots = yield* driveWithContext(
    childCtx,
    buildInitialSlotsGen(fragment, children, instance.endMarker, scheduler, slotId),
  );
  instance.mounted = true;

  return { fragment, instance, handle };
}
