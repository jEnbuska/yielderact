import type { StateHookState } from "../render/types";
import { $USE_STATE, type StateDescriptor } from "./descriptors";
import type { ComponentGenerator } from "./types";

/**
 * Persistent state hook for components.
 *
 * Returns `[currentValue, setter]`. Calling the setter stores the new value
 * and triggers a re-render. The value persists across re-renders even though
 * the generator function body is re-executed from the top each time.
 *
 * Must be called with `yield*` inside a component or hook.
 *
 * @example
 * function* Counter() {
 *   const [count, setCount] = yield* useState(0);
 *   return (
 *     <button onClick={() => setCount(count + 1)}>{count}</button>
 *   );
 * }
 *
 * // Lazy initializer – function is called only on the first render:
 * const [value, setValue] = yield* useState(() => expensiveComputation());
 *
 * // Functional updater – receives the previous state:
 * setValue(prev => prev + 1);
 *
 * NOTE: As in React, any function passed as `initialValue` or to the setter is
 * treated as a lazy initializer / updater respectively.  To store a function as
 * state, wrap it: `useState(() => myFn)` / `setState(() => newFn)`.
 */
export function* useState<T>(
  initialValue: T | (() => T),
): ComponentGenerator<[T, (value: T | ((prev: T) => T)) => Promise<void>]> {
  const desc: StateDescriptor = { type: $USE_STATE, initialValue };
  const stateTuple = yield desc;
  return stateTuple as [T, (value: T | ((prev: T) => T)) => Promise<void>];
}

/** @internal */
export function processState(descriptor: StateDescriptor, prev?: StateHookState): StateHookState {
  if (prev !== undefined) return prev;
  return {
    kind: $USE_STATE,
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
