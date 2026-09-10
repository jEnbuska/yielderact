import type { StableHookState } from "../render/types";
import { type StableDescriptor } from "./types";

import type { ComponentGenerator } from "../general-types";
import { $STABLE } from "./constants";

/**
 * Stable-identity function hook.
 *
 * Returns a wrapper whose identity never changes, but whose target function
 * is swapped each render so it always calls the latest `fn`. Useful for
 * passing stable event handlers to child components.
 */
export function* useStable<T extends (...args: any[]) => any>(fn: T): ComponentGenerator<T> {
  const desc: StableDescriptor = { type: $STABLE, fn };
  const stableFn = yield desc;
  return stableFn as T;
}

/** @internal */
export function processStable(
  descriptor: StableDescriptor,
  prev?: StableHookState,
): StableHookState {
  if (prev) {
    prev.current = descriptor.fn;
    return prev;
  }
  const state: StableHookState = {
    type: $STABLE,
    current: descriptor.fn,
    stable: undefined as unknown,
  };
  state.stable = (...args: unknown[]) => state.current(...args);
  return state;
}
