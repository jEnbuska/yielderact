/**
 * component/index.ts — Component instance creation and mounting.
 *
 * Public entry points:
 * - `createComponentInstance` — create a ComponentInstance with bound lifecycle closures.
 * - `mountComponent` — create the instance and run its initial render.
 */

import type { Component, InternalProps } from "../../jsx";
import { type CtxMap, drive, getContextMap, type RenderGenerator } from "../driver";
import type { ComponentInstance } from "../types";
import { initialComponentRender } from "./initial";
import { executeComponentRerender, rerenderInstance, resumeInstance } from "./rerender";

/**
 * Create a `ComponentInstance` with bound lifecycle closures.
 * Pure synchronous work — no yields.
 */
function createComponentInstance(
  component: Component,
  props: InternalProps,
  ctx: CtxMap,
): ComponentInstance {
  const instance: ComponentInstance = {
    component,
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
      drive(instance.capturedCtx, resumeInstance(instance));
    },
    executeRerender: () => {
      drive(instance.capturedCtx, executeComponentRerender(instance));
      return Promise.resolve();
    },
    rerender: () => rerenderInstance(instance),
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
): RenderGenerator<{ fragment: DocumentFragment; instance: ComponentInstance }> {
  const ctx = yield* getContextMap();
  const instance = createComponentInstance(component, props, ctx);
  const fragment = yield* initialComponentRender(instance);
  return { fragment, instance };
}
