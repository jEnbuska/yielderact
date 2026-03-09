import { $STATE, type HookContext } from "./symbols";

/**
 * Persistent state hook for generator components.
 *
 * Returns `[currentValue, setter]`. Calling the setter stores the new value
 * and triggers a re-render. The value persists across re-renders even though
 * the generator function body is re-executed from the top each time.
 *
 * Must be called with `yield*` inside a generator component or hook.
 *
 * @example
 * function* Counter(_props: object) {
 *   const [count, setCount] = yield* $state(0);
 *   return (
 *     <button onClick={() => setCount(count + 1)}>{count}</button>
 *   );
 * }
 *
 * // Lazy initializer – function is called only on the first render:
 * const [value, setValue] = yield* $state(() => expensiveComputation());
 *
 * // Functional updater – receives the previous state:
 * setValue(prev => prev + 1);
 *
 * NOTE: As in React, any function passed as `initialValue` or to the setter is
 * treated as a lazy initializer / updater respectively.  To store a function as
 * state, wrap it: `$state(() => myFn)` / `setState(() => newFn)`.
 */
export function* $state<T>(
  initialValue: T | (() => T),
): Generator<unknown, [T, (value: T | ((prev: T) => T)) => Promise<void>], unknown> {
  const stateTuple = yield { type: $STATE, initialValue };
  return stateTuple as [T, (value: T | ((prev: T) => T)) => Promise<void>];
}

/** @internal */
export function _processState(descriptor: { [key: string]: unknown }, ctx: HookContext): unknown {
  const { hookIndex, hookStates, rerender } = ctx;
  const existing = hookStates[hookIndex];
  if (existing === undefined || existing.kind !== "state") {
    const init = descriptor["initialValue"];
    hookStates[hookIndex] = {
      kind: "state",
      value: typeof init === "function" ? (init as () => unknown)() : init,
    };
  }
  // SAFETY: We just ensured hookStates[hookIndex] is a StateHookState above.
  const stateObj = hookStates[hookIndex] as import("../render/types").StateHookState;
  const setter = (newValue: unknown): Promise<void> => {
    stateObj.value =
      typeof newValue === "function"
        ? (newValue as (prev: unknown) => unknown)(stateObj.value)
        : newValue;
    return rerender();
  };
  return [stateObj.value, setter];
}
