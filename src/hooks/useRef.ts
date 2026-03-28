import type { RefHookState } from "../render/types";
import { $USE_REF, type RefDescriptor } from "./descriptors";
import type { ComponentGenerator } from "./types";

/**
 * A mutable ref object whose `.current` property persists across re-renders.
 */
export interface RefObject<T> {
  current: T;
}

/**
 * Persistent mutable ref hook for components.
 *
 * Returns a stable `{ current }` object whose value persists across re-renders
 * without triggering a re-render when mutated.
 *
 * Must be called with `yield*` inside a component or hook.
 *
 * **Overload 1 — no argument:** `.current` is `T | undefined`, initially `undefined`.
 * Useful for DOM refs that are set after mount.
 *
 * @example
 * function* InputFocus() {
 *   const ref = yield* useRef<HTMLInputElement>();
 *   return <input ref={ref} />;
 * }
 *
 * **Overload 2 — with initial value:** `.current` is `T` (non-optional).
 *
 * @example
 * function* Counter() {
 *   const renderCount = yield* useRef(0);
 *   renderCount.current += 1;
 * }
 */

// Overload 1: no argument — current is T | undefined
export function useRef<T>(): ComponentGenerator<RefObject<T | undefined>>;

// Overload 2: with initial value — current is T
export function useRef<T>(initialValue: T): ComponentGenerator<RefObject<T>>;

// Implementation
export function* useRef<T>(initialValue?: T): ComponentGenerator<RefObject<T | undefined>> {
  const desc: RefDescriptor = { type: $USE_REF, initialValue };
  const ref = yield desc;
  return ref as RefObject<T | undefined>;
}

/** @internal */
export function processRef(descriptor: RefDescriptor, prev?: RefHookState): RefHookState {
  if (prev !== undefined) return prev;
  return { kind: $USE_REF, current: descriptor.initialValue };
}
