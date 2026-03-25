/**
 * initial.ts — Initial component render.
 *
 * Handles the first render of a component, committing output to a
 * DocumentFragment. Delegates to `executeComponentRerender` for
 * any follow-up rerenders triggered during the initial render.
 */

import type { Child } from "../../jsx";
import { driveWithContext, getContext, type RenderGenerator } from "../driver";
import { flushEffects } from "../hooks-runtime";
import { reconcileSlotsGen } from "../reconciler";
import { RenderCtx } from "../state";
import type { ComponentInstance } from "../types";
import {
  drainResolvers,
  effectiveCtxMap,
  revertPendingEffects,
  runComponentRender,
} from "./lifecycle";
import { executeComponentRerender } from "./rerender";

/**
 * Initial render: run hooks, commit to a DocumentFragment, flush effects.
 *
 * If a `pendingRerender` was queued during the initial render (mid-render
 * setState), delegates to `executeComponentRerender` for follow-up renders.
 */
export function* initialComponentRender(
  instance: ComponentInstance,
): RenderGenerator<DocumentFragment> {
  const rctx = yield* getContext(RenderCtx);

  while (true) {
    const { vnode, cancelled } = yield* runComponentRender(instance, rctx);
    if (cancelled) {
      revertPendingEffects(instance);
      continue;
    }

    // Commit to fragment
    const commitCtxMap = effectiveCtxMap(instance);
    const fragment = document.createDocumentFragment();
    fragment.appendChild(instance.endMarker);
    const prevLiveOnly = rctx.liveOnlyMode;
    rctx.liveOnlyMode = false;
    instance.slots = yield* driveWithContext(
      commitCtxMap,
      reconcileSlotsGen(fragment, [], [vnode] satisfies Child[], instance.endMarker),
    );
    rctx.liveOnlyMode = prevLiveOnly;
    instance.mounted = true;
    flushEffects(instance);
    drainResolvers(instance);

    if (instance.pendingRerender) {
      instance.pendingRerender = false;
      yield* executeComponentRerender(instance, rctx);
    }
    return fragment;
  }
}
