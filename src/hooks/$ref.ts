import { $REF, type HookContext } from "./symbols";

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
 *   const ref = yield* $ref<HTMLInputElement | null>(null);
 *   return <input $ref={ref} />;
 * }
 */
export function* $ref<T>(initialValue: T): Generator<unknown, RefObject<T>, unknown> {
  const ref = yield { type: $REF, initialValue };
  return ref as RefObject<T>;
}

/** @internal */
export function _processRef(descriptor: { [key: string]: unknown }, ctx: HookContext): unknown {
  const { hookIndex, hookStates } = ctx;
  const existing = hookStates[hookIndex];
  if (existing === undefined || existing.kind !== "ref") {
    const newState = { kind: "ref" as const, current: descriptor["initialValue"] };
    hookStates[hookIndex] = newState;
    return newState;
  }
  return existing;
}
