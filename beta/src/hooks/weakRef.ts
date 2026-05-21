import type { WeakRefHookState } from "../render/types";
import type { WeakRefDescriptor } from "./descriptors";
import { $WEAK_REF } from "./descriptors";
import type { ComponentGenerator } from "./types";

/**
 * A mutable ref object whose `.current` persists across re-renders.
 */
export interface WeakRefObject<T extends WeakKey> {
  get current(): T | undefined;
  set current(value: T);
}

export function* $weakRef<T extends WeakKey>(): ComponentGenerator<WeakRefObject<T>> {
  const desc: WeakRefDescriptor = { type: $WEAK_REF };
  const weakRef = yield desc;
  return weakRef as WeakRefObject<T>;
}

/** @internal */
export function processWeakRef(prev?: WeakRefHookState): WeakRefHookState {
  if (prev !== undefined) return prev;
  let current: WeakRef<WeakKey> | undefined;
  return {
    type: $WEAK_REF,
    get current(): WeakKey | undefined {
      return current?.deref();
    },
    set current(value: WeakKey) {
      current = new WeakRef(value);
    },
  };
}
