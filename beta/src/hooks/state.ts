import type { StateHookState } from "../render/types";
import { $STATE, type StateDescriptor } from "./descriptors";
import type { ComponentGenerator } from "./types";

/**
 * Persistent state hook.
 *
 * @example
 * function* Counter() {
 *   const [count, setCount] = yield* $state(0);
 *   return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
 * }
 */
export function* $state<T>(
  initialValue: T | (() => T),
): ComponentGenerator<[T, (value: T | ((prev: T) => T)) => Promise<void>]> {
  const desc: StateDescriptor = { type: $STATE, initialValue };
  const stateTuple = yield desc;
  return stateTuple as [T, (value: T | ((prev: T) => T)) => Promise<void>];
}

/** @internal */
export function processState(descriptor: StateDescriptor, prev?: StateHookState): StateHookState {
  if (prev !== undefined) return prev;
  return {
    type: $STATE,
    value:
      typeof descriptor.initialValue === "function"
        ? (descriptor.initialValue as () => unknown)()
        : descriptor.initialValue,
  };
}

/** @internal */
export function createStateSetter(
  state: StateHookState,
  rerender: () => Promise<void>,
): (newValue: unknown) => Promise<void> {
  return (newValue: unknown): Promise<void> => {
    state.value =
      typeof newValue === "function"
        ? (newValue as (prev: unknown) => unknown)(state.value)
        : newValue;
    return rerender();
  };
}
