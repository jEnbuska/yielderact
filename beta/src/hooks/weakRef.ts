import type { WeakRefHookState } from "../render/types";

import { $WEAK_REF } from "./constants";
import { WeakRefDescriptor } from "./types";
import { WeakRefLike } from "../render/element-props";

export function* useWeakRef<T extends WeakKey>(
  initial?: T,
): Generator<WeakRefDescriptor, WeakRefLike<T>> {
  const desc: WeakRefDescriptor = { type: $WEAK_REF, initial };
  const result: WeakRefHookState<T> = yield desc;
  return result.ref as WeakRefLike<T>;
}
type GetCurrent = {
  deref(): undefined | WeakKey;
};
export const weakRefSymbol = Symbol($WEAK_REF);
/** @internal */
export function processWeakRef(prev?: WeakRefHookState): WeakRefHookState {
  if (prev !== undefined) return prev;
  let current: WeakRef<WeakKey> | undefined;
  function deref(): WeakKey | undefined {
    return current?.deref();
  }
  const wrapper = { deref };
  return {
    type: $WEAK_REF,
    ref: {
      [weakRefSymbol]: true,
      get current(): GetCurrent {
        return wrapper;
      },
      set current(value: WeakKey | undefined) {
        if (value === undefined) current = undefined;
        else current = new WeakRef(value);
      },
    },
  };
}
