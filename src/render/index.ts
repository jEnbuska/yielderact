import type { Context } from "../context";
import type { VNode } from "../jsx";
import { DelegationRoot } from "./delegation";
import { dispatchDelegatedEvent } from "./dispatch";
import { driveWithContext, type RenderGenerator } from "./driver";
import { buildNode } from "./initial-mount";
import { createRenderContext, RenderCtx, setActiveRenderCtx } from "./state";
import type { RenderContext } from "./types";

export { buildNode } from "./initial-mount";
export { flushSync } from "./scheduler";

/**
 * Run a render generator synchronously to completion.
 *
 * Used only for initial mount (`render()` / `createRoot().render()`).
 * After initial mount, all work goes through the scheduler.
 */
function runInitialMount<T>(
  initialCtxMap: ReadonlyMap<Context, unknown>,
  gen: RenderGenerator<T>,
): T {
  const rctx = initialCtxMap.get(RenderCtx as Context) as RenderContext;
  setActiveRenderCtx(rctx);

  const wrapped = driveWithContext(initialCtxMap, gen);
  let result = wrapped.next();
  while (!result.done) {
    result = wrapped.next(undefined);
  }
  return result.value;
}

/**
 * Render a VNode tree into a DOM container (simple one-shot mount).
 *
 * This is the minimal entry point — it builds the DOM and appends it.
 *
 * **Called by:** Application code for simple mounts, and test helpers.
 *
 * @example
 * render(<App />, document.getElementById('root')!);
 *
 * @param vnode     - The root VNode to render.
 * @param container - The DOM element to mount into.
 */
export function render(vnode: VNode, container: Element): void {
  const rctx = createRenderContext();
  rctx.delegationRoot = new DelegationRoot(container, (nativeEvent, domEvent) =>
    dispatchDelegatedEvent(nativeEvent, container, domEvent, rctx),
  );
  const initialMap: Map<Context, unknown> = new Map();
  initialMap.set(RenderCtx as Context, rctx);
  rctx.isInitialMount = true;
  try {
    container.appendChild(runInitialMount(initialMap, buildNode(vnode)));
  } finally {
    rctx.isInitialMount = false;
  }
}

/**
 * A root created by `createRoot`. Holds a reference to the container
 * element and provides a `render` method.
 */
export interface Root {
  /** Mount a VNode tree into the container. */
  render(vnode: VNode): void;
}

/**
 * Create a root for rendering into the given DOM container.
 *
 * **Called by:** Application code — the recommended way to mount an app.
 *
 * @example
 * const root = createRoot(document.getElementById('root')!);
 * root.render(<App />);
 *
 * @param container - The DOM element to render into.
 * @returns A `Root` object with a `render` method.
 */
export function createRoot(container: Element): Root {
  const rctx = createRenderContext();
  rctx.delegationRoot = new DelegationRoot(container, (nativeEvent, domEvent) =>
    dispatchDelegatedEvent(nativeEvent, container, domEvent, rctx),
  );
  return {
    render(vnode: VNode): void {
      const initialMap: Map<Context, unknown> = new Map();
      initialMap.set(RenderCtx as Context, rctx);
      rctx.isInitialMount = true;
      try {
        container.appendChild(runInitialMount(initialMap, buildNode(vnode)));
      } finally {
        rctx.isInitialMount = false;
      }
    },
  };
}
