import { $MEMO, type DependencyList, depsChanged, type HookContext } from "./symbols";

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
 *   const result = yield* $memo((a, b) => heavyCalc(a, b), [a, b]);
 *   return <div>{result}</div>;
 * }
 */
export function $memo<T>(fn: () => T, deps: []): Generator<unknown, T, unknown>;
export function $memo<T, Deps extends [unknown, ...unknown[]]>(
  fn: (...args: Deps) => T,
  deps: [...Deps],
): Generator<unknown, T, unknown>;
export function* $memo<T>(
  fn: (...args: unknown[]) => T,
  deps: DependencyList,
): Generator<unknown, T, unknown> {
  const value = yield { type: $MEMO, fn, deps };
  return value as T;
}

/** @internal */
export function _processMemo(descriptor: { [key: string]: unknown }, ctx: HookContext): unknown {
  const { hookIndex, hookStates } = ctx;
  const fn = descriptor["fn"] as (...args: unknown[]) => unknown;
  const deps = descriptor["deps"] as DependencyList;
  const existing = hookStates[hookIndex];
  if (existing === undefined || existing.kind !== "memo" || depsChanged(existing.deps, deps)) {
    const newState = { kind: "memo" as const, value: fn(...deps), deps };
    hookStates[hookIndex] = newState;
    return newState.value;
  }
  return existing.value;
}
