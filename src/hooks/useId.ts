import type { IdHookState } from "../render/types";
import { $USE_ID, type IdDescriptor } from "./descriptors";
import type { ComponentGenerator } from "./types";

// ── Global ID counter ─────────────────────────────────────────────────────
//
// Unique IDs must be globally unique across all roots, so the counter stays
// module-level rather than per-root.

/**
 * Auto-incrementing counter for stable unique IDs produced by `useId`.
 *
 * Incremented by `processId`. Each `useId()` call gets
 * `":r<N>:"` where N is the counter value at first mount.
 */
let idCounter = 0;

/** Allocate the next unique ID string. @internal */
function nextId(): string {
  return `:r${idCounter++}:`;
}

/**
 * Stable unique ID hook for components.
 *
 * Returns a string ID that is stable across re-renders and unique per hook
 * call site within the application.
 *
 * Must be called with `yield*` inside a component or hook.
 *
 * @example
 * function* LabelledInput() {
 *   const id = yield* useId();
 *   return (
 *     <>
 *       <label htmlFor={id}>Name</label>
 *       <input id={id} />
 *     </>
 *   );
 * }
 */
export function* useId(): ComponentGenerator<string> {
  const desc: IdDescriptor = { type: $USE_ID };
  const id = yield desc;
  return id as string;
}

/** @internal */
export function processId(prev?: IdHookState): IdHookState {
  if (prev !== undefined) return prev;
  return { kind: $USE_ID, id: nextId() };
}
