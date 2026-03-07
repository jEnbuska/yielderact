import { _batchCtx, useContext, type UseContextDescriptor } from '../context';

/**
 * Read the current `$patch` batch behaviour from the context.
 *
 * Works exactly like `useContext` — the component rerenders when the
 * effective batch changes (e.g. when a parent toggles `$patch`).
 *
 * @example
 * function* StatusBar() {
 *   const patch = yield* usePatchContext();
 *   return <span>{patch === 'live' ? 'Live' : 'Deferred'}</span>;
 * }
 */
export function* usePatchContext(): Generator<UseContextDescriptor, 'live' | 'default', unknown> {
  return yield* useContext(_batchCtx);
}
