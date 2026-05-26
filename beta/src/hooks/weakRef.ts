import type { WeakRefHookState } from "../render/types";
import { $WEAK_REF } from "./descriptors";

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
