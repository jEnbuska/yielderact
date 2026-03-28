import type { EffectHookState } from "../render/types";
import { $USE_EFFECT, type EffectDescriptor } from "./descriptors";
import type { ComponentGenerator, DependencyList } from "./types";
import { depsChanged } from "./types";

/**
 * Side-effect hook for components.
 *
 * Schedules `fn` to run **after** the component's DOM has been updated.
 * `fn` is called on the first render and again whenever any value in `deps`
 * changes (shallow `Object.is` comparison). If `fn` returns a function, that
 * function is used as a cleanup: it runs just before the next effect call and
 * when the component unmounts.
 *
 * `fn` receives an `AbortSignal` that is aborted just as the cleanup runs
 * (i.e. when deps change or the component unmounts). Use this signal to
 * cancel async work (e.g. `fetch`) without needing to return a cleanup fn.
 *
 * The effect is **not** fired while the generator is paused (e.g. inside a
 * `useRender` interaction) – only once the generator has returned its final
 * JSX and the resulting DOM is in place.
 *
 * Must be called with `yield*` inside a component.
 *
 * @example
 * function* Timer() {
 *   const [tick, setTick] = yield* useState(0);
 *   yield* useEffect((signal) => {
 *     const id = setInterval(() => setTick((t) => t + 1), 1000);
 *     return () => clearInterval(id);
 *   }, []);
 *   return <p>Seconds: {tick}</p>;
 * }
 */
export function* useEffect(
  fn: (signal: AbortSignal) => (() => void) | undefined,
  deps: DependencyList,
): ComponentGenerator<void> {
  const desc: EffectDescriptor = { type: $USE_EFFECT, fn, deps };
  yield desc;
}

/** @internal */
export function processEffect(
  descriptor: EffectDescriptor,
  prev?: EffectHookState,
): { state: EffectHookState; isNew: boolean } {
  if (prev !== undefined && !depsChanged(prev.deps, descriptor.deps)) {
    return { state: prev, isNew: false };
  }
  // Clean up previous effect
  if (prev !== undefined) {
    prev.controller.abort();
    prev.cleanup?.();
  }
  const controller = new AbortController();
  return {
    state: { kind: $USE_EFFECT, deps: descriptor.deps, controller },
    isNew: true,
  };
}
