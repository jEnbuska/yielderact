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
 * Persistent mutable ref hook for generator components.
 *
 * Returns a stable `{ current }` object whose value persists across re-renders
 * without triggering a re-render when mutated.
 *
 * Must be called with `yield*` inside a generator component or hook.
 *
 * @example
 * function* InputFocus() {
 *   const ref = yield* useRef<HTMLInputElement | null>(null);
 *   return <input $ref={ref} />;
 * }
 */
export function* useRef<T>(initialValue: T): ComponentGenerator<RefObject<T>> {
  const desc: RefDescriptor = { type: $USE_REF, initialValue };
  const ref = yield desc;
  return ref as RefObject<T>;
}

/** @internal */
export function _processRef(descriptor: RefDescriptor, prev?: RefHookState): RefHookState {
  if (prev !== undefined) return prev;
  return { kind: $USE_REF, current: descriptor.initialValue };
}
