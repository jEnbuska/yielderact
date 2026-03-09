import { $ID, type HookContext } from './symbols';
import { renderState } from '../render/state';

/**
 * Stable unique ID hook for generator components.
 *
 * Returns a string ID that is stable across re-renders and unique per hook
 * call site within the application.
 *
 * Must be called with `yield*` inside a generator component or hook.
 *
 * @example
 * function* LabelledInput(_props: object) {
 *   const id = yield* $id();
 *   return (
 *     <>
 *       <label htmlFor={id}>Name</label>
 *       <input id={id} />
 *     </>
 *   );
 * }
 */
export function* $id(): Generator<unknown, string, unknown> {
  const id = yield { type: $ID };
  return id as string;
}

/** @internal */
export function _processId(ctx: HookContext): unknown {
  const { hookIndex, hookStates } = ctx;
  if (!(hookIndex in hookStates)) {
    hookStates[hookIndex] = `:r${renderState.idCounter++}:`;
  }
  return hookStates[hookIndex];
}
