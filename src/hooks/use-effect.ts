import { USE_EFFECT } from './symbols';

/**
 * Side-effect hook for generator components.
 *
 * Schedules `fn` to run **after** the component's DOM has been updated.
 * `fn` is called on the first render and again whenever any value in `deps`
 * changes (shallow `Object.is` comparison). If `fn` returns a function, that
 * function is used as a cleanup: it runs just before the next effect call and
 * when the component unmounts.
 *
 * The effect is **not** fired while the generator is paused (e.g. inside a
 * `useRender` interaction) – only once the generator has returned its final
 * JSX and the resulting DOM is in place.
 *
 * Must be called with `yield*` inside a generator component.
 *
 * @example
 * function* Timer(_props: object) {
 *   const [tick, setTick] = yield* useState(0);
 *   yield* useEffect(() => {
 *     const id = setInterval(() => setTick((t) => t + 1), 1000);
 *     return () => clearInterval(id);
 *   }, []);
 *   return <p>Seconds: {tick}</p>;
 * }
 */
export function* useEffect(
  fn: () => (() => void) | void,
  deps: unknown[],
): Generator<unknown, void, unknown> {
  yield { type: USE_EFFECT, fn, deps };
}
