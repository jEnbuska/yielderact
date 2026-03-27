/**
 * initial.ts — Initial component render.
 *
 * Handles the first render of a component, committing output to a
 * DocumentFragment. Delegates to `executeComponentRerender` for
 * any follow-up rerenders triggered during the initial render.
 */

import type { Child } from "../../jsx";
import { driveWithContext, getContextMap, type RenderGenerator } from "../driver";
import { flushEffects } from "../hooks-runtime";
import { reconcileSlotsGen } from "../reconciler";
import { RenderCtx } from "../state";
import type { ComponentInstance, RenderContext } from "../types";
import { drainResolvers, revertPendingEffects, runComponentRender } from "./lifecycle";
import { executeComponentRerender } from "./rerender";

/** Retry rendering until a non-cancelled result is produced. */
function* renderUntilSuccess(
  instance: ComponentInstance,
  rctx: RenderContext,
): RenderGenerator<Child> {
  while (true) {
    const { vnode, cancelled } = yield* runComponentRender(instance, rctx);
    if (!cancelled) return vnode;
    revertPendingEffects(instance);
  }
}

/**
 * Initial render: run hooks, commit to a DocumentFragment, flush effects.
 *
 * If a `pendingRerender` was queued during the initial render (mid-render
 * setState), delegates to `executeComponentRerender` for follow-up renders.
 */
export function* initialComponentRender(
  instance: ComponentInstance,
): RenderGenerator<DocumentFragment> {
  const ctx = yield* getContextMap();
  const rctx = ctx.get(RenderCtx);
  const vnode = yield* renderUntilSuccess(instance, rctx);

  // Commit to fragment
  const fragment = document.createDocumentFragment();
  fragment.appendChild(instance.endMarker);
  const { liveOnlyMode: prevLiveOnly } = rctx;
  rctx.liveOnlyMode = false;
  instance.slots = yield* driveWithContext(
    ctx,
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
