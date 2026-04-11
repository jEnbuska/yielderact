import type { RefHookState } from "../render/types";
import { $REF, type RefDescriptor } from "./descriptors";
import type { ComponentGenerator } from "./types";

/**
 * A mutable ref object whose `.current` persists across re-renders.
 */
export interface RefObject<T> {
  current: T;
}

export function $ref<T>(): ComponentGenerator<RefObject<T | undefined>>;
export function $ref<T>(initialValue: T): ComponentGenerator<RefObject<T>>;
export function* $ref<T>(initialValue?: T): ComponentGenerator<RefObject<T | undefined>> {
  const desc: RefDescriptor = { type: $REF, initialValue };
  const ref = yield desc;
  return ref as RefObject<T | undefined>;
}

/** @internal */
export function processRef(descriptor: RefDescriptor, prev?: RefHookState): RefHookState {
  if (prev !== undefined) return prev;
  return { type: $REF, current: descriptor.initialValue };
}
