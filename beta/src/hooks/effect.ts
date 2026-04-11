import type { EffectHookState } from "../render/types";
import { $EFFECT, type EffectDescriptor } from "./descriptors";
import type { ComponentGenerator, DependencyList } from "./types";
import { depsChanged } from "./utils";

/**
 * Side-effect hook. Runs `fn` after DOM updates, re-runs when deps change.
 * The `fn` receives an `AbortSignal` that is aborted on cleanup.
 * If `fn` returns a function, it is called on next run or on unmount.
 */
export function* $effect(
  fn: (signal: AbortSignal) => void | Promise<void>,
  deps: DependencyList,
): ComponentGenerator<void> {
  yield { type: $EFFECT, fn, deps } satisfies EffectDescriptor;
}

/** @internal */
export function processEffect(
  descriptor: EffectDescriptor,
  prev?: EffectHookState,
): EffectHookState {
  if (prev === undefined) {
    // First run — no controller yet; afterRender will create one and run fn.
    return { type: $EFFECT, deps: descriptor.deps, fn: descriptor.fn };
  }
  if (depsChanged(prev.deps, descriptor.deps)) {
    prev.deps = descriptor.deps;
    prev.fn = descriptor.fn;
    prev.dirty = true;
  }
  return prev;
}
