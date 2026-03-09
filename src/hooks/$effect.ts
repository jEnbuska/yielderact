import { $EFFECT, depsChanged, type HookContext } from './symbols';

/**
 * Side-effect hook for generator components.
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
 * `$render` interaction) – only once the generator has returned its final
 * JSX and the resulting DOM is in place.
 *
 * Must be called with `yield*` inside a generator component.
 *
 * @example
 * function* Timer(_props: object) {
 *   const [tick, setTick] = yield* $state(0);
 *   yield* $effect((signal) => {
 *     const id = setInterval(() => setTick((t) => t + 1), 1000);
 *     return () => clearInterval(id);
 *   }, []);
 *   return <p>Seconds: {tick}</p>;
 * }
 */
export function* $effect(
  fn: (signal: AbortSignal) => (() => void) | void,
  deps: unknown[],
): Generator<unknown, void, unknown> {
  yield { type: $EFFECT, fn, deps };
}

/** @internal */
export function _processEffect(descriptor: { [key: string]: unknown }, ctx: HookContext): unknown {
  type EffectState = {
    deps: unknown[];
    cleanup: (() => void) | void;
    controller: AbortController;
  };
  const { hookIndex, hookStates, cleanupFns, pendingEffects } = ctx;
  const fn = descriptor['fn'] as (signal: AbortSignal) => (() => void) | void;
  const deps = descriptor['deps'] as unknown[];
  const existing = hookStates[hookIndex] as EffectState | undefined;

  if (!existing || depsChanged(existing.deps, deps)) {
    if (existing) {
      existing.controller.abort();
      existing.cleanup?.();
    }
    const controller = new AbortController();
    hookStates[hookIndex] = { deps, cleanup: undefined, controller } satisfies EffectState;
    pendingEffects.push({ hookIndex, fn, controller });
    cleanupFns[hookIndex] = () => {
      const state = hookStates[hookIndex] as EffectState;
      state.controller.abort();
      state.cleanup?.();
    };
  }
  return undefined;
}
