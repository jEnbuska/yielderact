/**
 * initial.ts — Initial component render.
 *
 * Handles the first render of a component, committing output to a
 * DocumentFragment.
 */

import type { Child } from "../../jsx";
import { driveWithContext, getContextMap, type RenderGenerator } from "../driver";
import { flushEffects } from "../hooks-runtime";
import { reconcileSlotsGen } from "../reconciler";
import type { ComponentInstance } from "../types";
import { runComponentRender } from "./lifecycle";

/**
 * Initial render: run hooks, commit to a DocumentFragment, flush effects.
 */
export function* initialComponentRender(
  instance: ComponentInstance,
): RenderGenerator<DocumentFragment> {
  const ctx = yield* getContextMap();
  const vnode = yield* runComponentRender(instance);

  const fragment = document.createDocumentFragment();
  fragment.appendChild(instance.endMarker);
  instance.slots = yield* driveWithContext(
    ctx,
    reconcileSlotsGen(fragment, [], [vnode] satisfies Child[], instance.endMarker),
  );
  instance.mounted = true;
  flushEffects(instance);
  return fragment;
}
