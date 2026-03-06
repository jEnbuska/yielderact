import { USE_MEMO } from './symbols';

/**
 * Memoized value hook for generator components.
 *
 * Calls `fn(...deps)` on the first render and re-calls it only when the
 * dependency values change (shallow `Object.is` comparison).  The previous
 * result is returned unchanged between dependency updates.
 *
 * Unlike React's `useMemo`, the dependency values are forwarded as arguments
 * to the factory function.
 *
 * Must be called with `yield*` inside a generator component or hook.
 *
 * @example
 * function* Expensive({ a, b }: { a: number; b: number }) {
 *   const result = yield* useMemo((a, b) => heavyCalc(a, b), [a, b]);
 *   return <div>{result}</div>;
 * }
 */
export function useMemo<T>(fn: () => T, deps: []): Generator<unknown, T, unknown>;
export function useMemo<T, Deps extends [unknown, ...unknown[]]>(
  fn: (...args: Deps) => T,
  deps: [...Deps],
): Generator<unknown, T, unknown>;
export function* useMemo<T>(
  fn: (...args: unknown[]) => T,
  deps: unknown[],
): Generator<unknown, T, unknown> {
  const value = yield { type: USE_MEMO, fn, deps };
  return value as T;
}
