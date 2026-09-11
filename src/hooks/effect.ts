import type { EffectHookState, HookState } from "../render/types";
import type { EffectCallback} from "./types";
import { type EffectDescriptor } from "./types";
import type { ComponentFiber } from "../instances/component-fiber";
import { depsChanged } from "../general";
import type { ComponentGenerator, DependencyList } from "../general-types";
import { $EFFECT } from "./constants";

/**
 * Side-effect hook. Runs `fn` after DOM updates, re-runs when deps change.
 * The `fn` receives an `AbortSignal` that is aborted on cleanup.
 * If `fn` returns a function, it is called on next run or on unmount.
 */
export function* useEffect(
  fn: EffectCallback,
  deps: DependencyList = [],
): ComponentGenerator<void> {
  yield { type: $EFFECT, fn, deps } satisfies EffectDescriptor;
}

/** @internal */
export function processEffect(
  instance: ComponentFiber,
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
    const cleanup = state.fn(controller.signal);
    if (typeof cleanup === 'function') controller.signal.onabort = () => cleanup();
  } else if (state.dirty) {
    state.controller.abort();
    const controller = new AbortController();
    state.controller = controller;
    state.dirty = false;
    const cleanup = state.fn(controller.signal);
    if (typeof cleanup === 'function') controller.signal.onabort = () => cleanup();
  }
}
