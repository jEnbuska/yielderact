import { _getCtxMap, _setCtxMap, _withBatch } from "../context";
import type { VNode } from "../jsx";
import { buildNode } from "./mount";
import { _setActiveCtx, createRenderContext } from "./state";

export { buildNode } from "./mount";
export { commitUIPatch, startUIPatch } from "./patch";
export { flushSync, scheduleUpdate } from "./scheduler";

/**
 * Render a VNode tree into a DOM container (simple one-shot mount).
 *
 * This is the minimal entry point — it builds the DOM and appends it.
 * Unlike `createRoot`, it does **not** establish a `$patch="default"`
 * batch context, so `usePatchContext` will return the context's default
 * value (`'default'`) unless a `$patch` prop is set somewhere in the tree.
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
  _setActiveCtx(rctx);
  rctx.isInitialMount = true;
  try {
    container.appendChild(buildNode(vnode));
  } finally {
    rctx.isInitialMount = false;
  }
}

/**
 * A root created by `createRoot`. Holds a reference to the container
 * element and provides a `render` method that establishes the top-level
 * `$patch="default"` batch context for the entire component tree.
 */
export interface Root {
  /** Mount a VNode tree into the container with `$patch="default"` context. */
  render(vnode: VNode): void;
}

/**
 * Create a root for rendering into the given DOM container.
 *
 * The root provides `$patch="default"` as a top-level batch context for
 * the entire component tree, using the same context-map mechanism as
 * application contexts created with `createContext`. This means
 * `usePatchContext()` returns `'default'` by default, and components
 * can override it with `$patch="live"`.
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
  return {
    render(vnode: VNode): void {
      _setActiveCtx(rctx);
      const prevCtx = _getCtxMap();
      _setCtxMap(_withBatch(prevCtx, "default"));
      rctx.isInitialMount = true;
      try {
        container.appendChild(buildNode(vnode));
      } finally {
        rctx.isInitialMount = false;
        _setCtxMap(prevCtx);
      }
    },
  };
}
