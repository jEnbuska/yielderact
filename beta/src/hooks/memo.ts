import type { MemoHookState } from "../render/types";
import { $MEMO, type MemoDescriptor } from "./descriptors";
import type { ComponentGenerator, DependencyList } from "./types";
import { depsChanged } from "./utils";

/**
 * Memoized value hook. Re-computes only when deps change.
 * Dependency values are forwarded as arguments to the factory.
 */

export function $memo<T, Deps extends [unknown, ...unknown[]]>(
  fn: (...args: Deps) => T,
  deps: [...Deps],
): ComponentGenerator<T>;
export function $memo<T>(fn: () => T, deps?: DependencyList): ComponentGenerator<T>;
export function* $memo<T>(
  fn: (...args: unknown[]) => T,
  deps: DependencyList = [],
): ComponentGenerator<T> {
  const desc: MemoDescriptor = { type: $MEMO, fn, deps };
  const value = yield desc;
  return value as T;
}

/** @internal */
export function processMemo(descriptor: MemoDescriptor, prev?: MemoHookState): MemoHookState {
  if (prev !== undefined && !depsChanged(prev.deps, descriptor.deps)) return prev;
  return {
    type: $MEMO,
    value: descriptor.fn(...descriptor.deps),
    deps: descriptor.deps,
  };
}
