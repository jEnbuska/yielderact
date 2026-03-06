/** @internal */
export const USE_STATE = Symbol('useState');
/** @internal */
export const USE_REF = Symbol('useRef');
/** @internal */
export const USE_ID = Symbol('useId');
/** @internal */
export const USE_MEMO = Symbol('useMemo');
/** @internal */
export const USE_RESOLVE_RAW = Symbol('useResolveRaw');
/** @internal */
export const USE_RESOLVE = Symbol('useResolve');
/** @internal */
export const USE_EFFECT = Symbol('useEffect');
/** @internal */
export const USE_RENDER = Symbol('useRender');
/** @internal */
export const USE_UI_PATCH = Symbol('useUIPatch');

/** Returns true when the dependency arrays differ (shallow Object.is comparison). */
export function depsChanged(prev: unknown[] | undefined, next: unknown[]): boolean {
  if (prev === undefined) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true;
  }
  return false;
}
