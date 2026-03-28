import type { Context } from "../context";
import type { VNode } from "../jsx";
import { DelegationRoot } from "./delegation";
import { dispatchDelegatedEvent } from "./dispatch";
import { drive } from "./driver";
import { buildNode } from "./mount";
import { createRenderContext, RenderCtx } from "./state";

export { buildNode } from "./mount";
export { flushSync } from "./scheduler";

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
    container.appendChild(drive(initialMap, buildNode(vnode)).value);
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
        container.appendChild(drive(initialMap, buildNode(vnode)).value);
      } finally {
        rctx.isInitialMount = false;
      }
    },
  };
}
