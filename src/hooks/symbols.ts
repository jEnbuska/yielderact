import type { GenInstance, HookState } from "../render/types";

/**
 * Parameters provided to hook handler functions by the renderer.
 * @internal
 */
export interface HookContext {
  hookIndex: number;
  hookStates: HookState[];
  cleanupFns: ((() => void) | undefined)[];
  pendingEffects: Array<{
    hookIndex: number;
    fn: (signal: AbortSignal) => (() => void) | undefined;
    controller: AbortController;
  }>;
  rerender: () => Promise<void>;
  resume: () => void;
  instance: GenInstance;
  collectDescendants: (instance: GenInstance) => GenInstance[];
  flushPendingVNodes: (instances: GenInstance[]) => void;
}

/** @internal */
export const $STATE = Symbol("$state");
/** @internal */
export const $REF = Symbol("$ref");
/** @internal */
export const $ID = Symbol("$id");
/** @internal */
export const $MEMO = Symbol("$memo");
/** @internal */
export const $RESOLVE_RAW = Symbol("$resolveRaw");
/** @internal */
export const $RESOLVE = Symbol("$resolve");
/** @internal */
export const $EFFECT = Symbol("$effect");
/** @internal */
export const $RENDER = Symbol("$render");
/** @internal */
export const $UI_PATCH = Symbol("$uiPatch");

/**
 * Hook dependency list type, aligned with React 19's `DependencyList`.
 *
 * A read-only array of values compared via shallow `Object.is` by the
 * renderer. Hooks re-run only when at least one element changes.
 */
export type DependencyList = readonly unknown[];

/** Returns true when the dependency arrays differ (shallow Object.is comparison). */
export function depsChanged(prev: DependencyList | undefined, next: DependencyList): boolean {
  if (prev === undefined) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true;
  }
  return false;
}
