import type { EffectHookState, HookState } from "../render/types";
import { $EFFECT, type EffectDescriptor } from "./descriptors";
import type { ComponentGenerator, DependencyList } from "./types";
import { depsChanged } from "./utils";
import type { BaseInstance } from "../instances/base-instance";

/**
 * Side-effect hook. Runs `fn` after DOM updates, re-runs when deps change.
 * The `fn` receives an `AbortSignal` that is aborted on cleanup.
 * If `fn` returns a function, it is called on next run or on unmount.
 */
export function* $effect(
  fn: (signal: AbortSignal) => void | Promise<void>,
  deps: DependencyList = [],
): ComponentGenerator<void> {
  yield { type: $EFFECT, fn, deps } satisfies EffectDescriptor;
}

/** @internal */
export function processEffect(
  instance: BaseInstance,
  descriptor: EffectDescriptor,
  state: EffectHookState | undefined,
): EffectHookState {
  if (!state) {
    const identifier = Symbol($EFFECT);
    instance.scheduleEffect(identifier);
    // First run — no controller yet; afterRender will create one and run fn.
    return {
      type: $EFFECT,
      deps: descriptor.deps,
      fn: descriptor.fn,
      identifier,
    };
  }
  if (depsChanged(state.deps, descriptor.deps)) {
    state.dirty = true;
    state.deps = descriptor.deps;
    state.fn = descriptor.fn;
    instance.scheduleEffect(state.identifier);
  }
  return state;
}

export function effectResolver(state: HookState) {
  if (state.type !== $EFFECT) return;
  if (!state.controller) {
    const controller = new AbortController();
    state.controller = controller;
    void state.fn(controller.signal);
  } else if (state.dirty) {
    state.controller.abort();
    const controller = new AbortController();
    state.controller = controller;
    state.dirty = false;
    void state.fn(controller.signal);
  }
}
