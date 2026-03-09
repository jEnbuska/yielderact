import { _batchCtx, $context, type UseContextDescriptor } from "../context";

/**
 * Read the current `$patch` batch behaviour from the context.
 *
 * Works exactly like `$context` — the component rerenders when the
 * effective batch changes (e.g. when a parent toggles `$patch`).
 *
 * @example
 * function* StatusBar() {
 *   const patch = yield* $patchContext();
 *   return <span>{patch === 'live' ? 'Live' : 'Deferred'}</span>;
 * }
 */
export function* $patchContext(): Generator<UseContextDescriptor, "live" | "default", unknown> {
  return yield* $context(_batchCtx);
}
