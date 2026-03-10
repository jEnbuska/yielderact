import type { MemoHookState } from "../render/types";
import { $USE_MEMO, type MemoDescriptor } from "./descriptors";
import type { ComponentGenerator, DependencyList } from "./types";
import { depsChanged } from "./types";

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
export function useMemo<T>(fn: () => T, deps: []): ComponentGenerator<T>;
export function useMemo<T, Deps extends [unknown, ...unknown[]]>(
  fn: (...args: Deps) => T,
  deps: [...Deps],
): ComponentGenerator<T>;
export function* useMemo<T>(
  fn: (...args: unknown[]) => T,
  deps: DependencyList,
): ComponentGenerator<T> {
  const desc: MemoDescriptor = { type: $USE_MEMO, fn, deps };
  const value = yield desc;
  return value as T;
}

/** @internal */
export function _processMemo(descriptor: MemoDescriptor, prev?: MemoHookState): MemoHookState {
  if (prev !== undefined && !depsChanged(prev.deps, descriptor.deps)) return prev;
  return {
    kind: $USE_MEMO,
    value: descriptor.fn(...descriptor.deps),
    deps: descriptor.deps,
  };
}
