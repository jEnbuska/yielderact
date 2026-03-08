import { USE_ID } from './symbols';

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
  const id = yield { type: USE_ID };
  return id as string;
}
