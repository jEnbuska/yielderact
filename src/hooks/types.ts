import type { Child } from "../jsx";
import type { HookDescriptor } from "./descriptors";

/**
 * Hook dependency list type, aligned with React 19's `DependencyList`.
 *
 * A read-only array of values compared via shallow `Object.is` by the
 * renderer. Hooks re-run only when at least one element changes.
 */
export type DependencyList = readonly unknown[];

/**
 * Generator type returned by hook functions and component bodies.
 *
 * `TReturn` (first param) is what the generator returns — typically `Child`
 * for components or a hook-specific result type.
 *
 * `TYield` (second param) is the set of values the generator may yield.
 * Defaults to `HookDescriptor | Child` — the full union a component body
 * can produce via `yield*` delegation.
 */
export type ComponentGenerator<TReturn, TYield = HookDescriptor | Child> = Generator<
  TYield,
  TReturn,
  unknown
>;

/** Returns true when the dependency arrays differ (shallow Object.is comparison). */
export function depsChanged(prev: DependencyList | undefined, next: DependencyList): boolean {
  if (prev === undefined) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true;
  }
  return false;
}
