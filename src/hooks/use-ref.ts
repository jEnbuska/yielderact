import { USE_REF } from './symbols';

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
 * function* InputFocus(_props: object) {
 *   const ref = yield* useRef<HTMLInputElement | null>(null);
 *   return <input ref={ref} />;
 * }
 */
export function* useRef<T>(initialValue: T): Generator<unknown, RefObject<T>, unknown> {
  const ref = yield { type: USE_REF, initialValue };
  return ref as RefObject<T>;
}
