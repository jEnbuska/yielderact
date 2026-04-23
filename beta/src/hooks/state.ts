import { createResolvable } from "../create-resolvable";
import type { BaseInstance } from "../instances/base-instance";
import type { StateHookState } from "../render/types";
import { $STATE, type StateDescriptor } from "./descriptors";
import type { ComponentGenerator, DependencyList } from "./types";
import { depsChanged } from "./utils";
import { getStateReason } from "../render-reasons";

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
  deps: DependencyList = [],
): ComponentGenerator<[T, (value: T | ((prev: T) => T)) => Promise<void>]> {
  const desc: StateDescriptor = { type: $STATE, initialValue, deps };
  const stateTuple = yield desc;
  return stateTuple as [T, (value: T | ((prev: T) => T)) => Promise<void>];
}

export function processState(descriptor: StateDescriptor, prev?: StateHookState): StateHookState {
  if (!prev) {
    const value = resolveValue(descriptor.initialValue);
    return {
      type: $STATE,
      value,
      identifier: getStateReason(),
      pendingValue: value,
      deps: descriptor.deps,
    };
  }

  if (depsChanged(prev.deps, descriptor.deps)) {
    const value = resolveValue(descriptor.initialValue);
    prev.value = value;
    prev.pendingValue = value;
    prev.pendingResolve = undefined;
    prev.deps = descriptor.deps;
    return prev;
  }
  prev.value = prev.pendingValue;
  return prev;
}

function resolveValue<T>(initialValue: T | (() => T)): T {
  return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
}

/** @internal */
export function createStateSetter(
  instance: BaseInstance,
  state: StateHookState,
): (newValue: unknown) => Promise<void> {
  return (newValue: unknown): Promise<void> => {
    const nextValue = resolveNextValue(newValue, state.pendingValue);
    // No change — cancel any pending rerender and resolve immediately.
    if (nextValue === state.value) {
      state.pendingValue = state.value;
      state.pendingResolve = undefined;
      instance.unscheduleRender(state.identifier);
      instance.unscheduleResolve(state.identifier);
      return Promise.resolve();
    }

    // Same value already pending — don't reschedule, but return a new
    // promise that resolves when the already-scheduled rerender completes.
    if (nextValue === state.pendingValue) {
      const { promise, resolve } = createResolvable();
      state.pendingResolve = resolve;
      return promise;
    }

    // New value — abandon any previous pending promise (it will never
    // resolve), schedule a rerender, and return a new promise that
    // resolves when the rerender completes.
    state.pendingValue = nextValue;
    const { promise, resolve } = createResolvable();
    state.pendingResolve = resolve;
    instance.scheduleRender(state.identifier);
    instance.scheduleResolve(state.identifier);
    return promise;
  };
}

export function resolveNextValue<T>(value: T | ((prev: T) => T), currentPendingValue: T): T {
  return typeof value === "function" ? (value as (prev: T) => T)(currentPendingValue) : value;
}
