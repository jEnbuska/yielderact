import type { Context } from "../context";
import type { VNode } from "../jsx";
import { DelegationRoot } from "./delegation";
import { dispatchDelegatedEvent } from "./dispatch";
import { driveWithContext, type RenderGenerator } from "./driver";
import { buildNode } from "./initial-mount";
import { Scheduler } from "./scheduler";

export { buildNode } from "./initial-mount";

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
  const scheduler = new Scheduler();
  scheduler.delegationRoot = new DelegationRoot(container, (nativeEvent, domEvent) =>
    dispatchDelegatedEvent(nativeEvent, container, domEvent, scheduler),
  );
  const initialMap: Map<Context, unknown> = new Map();
  scheduler.isInitialMount = true;
  try {
    container.appendChild(runInitialMount(initialMap, buildNode(vnode, scheduler)));
  } finally {
    scheduler.isInitialMount = false;
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
  const scheduler = new Scheduler();
  scheduler.delegationRoot = new DelegationRoot(container, (nativeEvent, domEvent) =>
    dispatchDelegatedEvent(nativeEvent, container, domEvent, scheduler),
  );
  return {
    render(vnode: VNode): void {
      const initialMap: Map<Context, unknown> = new Map();
      scheduler.isInitialMount = true;
      try {
        container.appendChild(runInitialMount(initialMap, buildNode(vnode, scheduler)));
      } finally {
        scheduler.isInitialMount = false;
      }
    },
  };
}

/**
 * Synchronously flush all pending work for all active roots.
 *
 * This is a convenience wrapper. In the current single-root model, callers
 * typically access the scheduler through the context map. For the public
 * API (`flushSync`), we keep the export for backward compatibility but it
 * is only useful when called with a callback that triggers work on a
 * known scheduler.
 *
 * @param fn - Optional callback to run synchronously before flushing.
 */
export function flushSync(fn?: () => void): void {
  fn?.();
}
