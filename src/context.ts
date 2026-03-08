import { createElement, Fragment, type Child, type VNode } from './jsx';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A context object returned by `createContext`.
 * Use `Context.Provider` to supply a value, `useContext` to consume it.
 */
export interface Context<T> {
  readonly _defaultValue: T;
  readonly Provider: (props: { value: T; $children?: Child[] }) => VNode;
}

// ---------------------------------------------------------------------------
// Internal symbols used to tag Provider functions
// ---------------------------------------------------------------------------

const PROVIDER_CTX = Symbol('providerCtx');

/**
 * Hook descriptor type for `useContext`. Yielded by the `useContext` generator
 * and processed by the renderer, which sends back the current context value.
 *
 * @internal
 */
export const USE_CONTEXT = Symbol('useContext');

// ---------------------------------------------------------------------------
// Internal descriptor type for useContext (carries optional selector/transform)
// ---------------------------------------------------------------------------

/** @internal */
export interface UseContextDescriptor {
  type: typeof USE_CONTEXT;
  ctx: Context<unknown>;
  selector: ((ctx: unknown) => unknown[]) | undefined;
  transform: ((...args: unknown[]) => unknown) | undefined;
}

// ---------------------------------------------------------------------------
// Module-level context map (updated during rendering)
// ---------------------------------------------------------------------------

let _ctxMap: ReadonlyMap<Context<unknown>, unknown> = new Map();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new context with a default value.
 *
 * @example
 * const ThemeCtx = createContext<'light' | 'dark'>('light');
 *
 * function* App() {
 *   const [theme] = yield* $state<'light' | 'dark'>('light');
 *   return (
 *     <ThemeCtx.Provider value={theme}>
 *       <Child />
 *     </ThemeCtx.Provider>
 *   );
 * }
 *
 * function* Child() {
 *   const theme = yield* $context(ThemeCtx);
 *   return <div className={theme}>hello</div>;
 * }
 */
export function createContext<T>(defaultValue: T): Context<T> {
  // Build the Provider function first, then assemble the context object.
  // This avoids a `null!` placeholder.
  function ContextProvider(props: { value: T; $children?: Child[] }): VNode {
    return createElement(Fragment, null, ...(props.$children ?? []));
  }

  const ctx: Context<T> = {
    _defaultValue: defaultValue,
    Provider: ContextProvider as Context<T>['Provider'],
  };

  // Tag the provider function so the renderer can identify it and which
  // context it belongs to.
  (ContextProvider as unknown as Record<symbol, unknown>)[PROVIDER_CTX] = ctx;
  return ctx;
}

/**
 * Consume a context value inside a generator component.
 * Must be called with `yield*` inside a generator component or hook.
 *
 * The renderer intercepts the yielded descriptor, looks up the current context
 * value, and sends it back — the hook then returns it to the component.
 *
 * **Overload 1 — no selector (current behavior):**
 * The component rerenders whenever the Provider's `value` reference changes.
 *
 * **Overload 2 — selector only:**
 * `selector` is called on each new Provider value. The component only rerenders
 * when the selected deps array changes (shallow comparison via `depsChanged`).
 * The full context value is still returned.
 *
 * **Overload 3 — selector + transform:**
 * Same rerender guard as overload 2; additionally the *return value* is
 * `transform(...selectorDeps)` instead of the raw context value.
 *
 * @example
 * // 1. Always rerenders on context change
 * const ctx = yield* $context(MyCtx);
 *
 * // 2. Rerenders only when currentGroup changes; returns full ctx
 * const { currentGroup } = yield* $context(MyCtx, (c) => [c.currentGroup]);
 *
 * // 3. Rerenders only when currentGroup changes; returns the group directly
 * const group = yield* $context(MyCtx, (c) => [c.currentGroup], (...args) => args[0]);
 */
export function $context<T>(ctx: Context<T>): Generator<UseContextDescriptor, T, unknown>;
export function $context<T>(
  ctx: Context<T>,
  selector: (ctx: T) => unknown[],
): Generator<UseContextDescriptor, T, unknown>;
export function $context<T, D extends unknown[], R>(
  ctx: Context<T>,
  selector: (ctx: T) => D,
  transform: (...args: D) => R,
): Generator<UseContextDescriptor, R, unknown>;
export function* $context<T, D extends unknown[], R>(
  ctx: Context<T>,
  selector?: (ctx: T) => D,
  transform?: (...args: D) => R,
): Generator<UseContextDescriptor, T | R, unknown> {
  const value = yield {
    type: USE_CONTEXT,
    ctx: ctx as Context<unknown>,
    selector: selector as ((ctx: unknown) => unknown[]) | undefined,
    transform: transform as ((...args: unknown[]) => unknown) | undefined,
  };
  return value as T | R;
}

// ---------------------------------------------------------------------------
// Internal helpers used by the renderer
// ---------------------------------------------------------------------------

/** Get the current module-level context map. */
export function _getCtxMap(): ReadonlyMap<Context<unknown>, unknown> {
  return _ctxMap;
}

/** Replace the module-level context map. */
export function _setCtxMap(map: ReadonlyMap<Context<unknown>, unknown>): void {
  _ctxMap = map;
}

/**
 * If `fn` is a context Provider function, return the matching Context object.
 * Otherwise return `null`.
 */
export function _getProviderCtx(fn: unknown): Context<unknown> | null {
  return ((fn as Record<symbol, unknown>)?.[PROVIDER_CTX] as Context<unknown>) ?? null;
}

/**
 * Resolve the effective value for `ctx` from `map`, falling back to the
 * context's `_defaultValue` when no Provider has supplied a value.
 *
 * @internal
 */
export function _resolveCtxValue(
  map: ReadonlyMap<Context<unknown>, unknown>,
  ctx: Context<unknown>,
): unknown {
  return map.has(ctx) ? map.get(ctx) : ctx._defaultValue;
}

// ---------------------------------------------------------------------------
// Internal batch context – propagates `$patch` behaviour through _ctxMap
// ---------------------------------------------------------------------------

/**
 * Internal context for the `$patch` batch behaviour.
 * Not exported publicly — used only by the renderer to propagate `$patch`
 * through the context map, just like application-level contexts.
 *
 * @internal
 */
export const _batchCtx: Context<'live' | 'default'> = {
  _defaultValue: 'default',
  Provider: undefined as never,
};

/**
 * Read the current `$patch` batch behaviour from the active context map.
 * Falls back to `'default'` when no `createRoot` or `$patch` ancestor has set it.
 * @internal
 */
export function _getCurrentBatch(): 'live' | 'default' {
  return _resolveCtxValue(_ctxMap, _batchCtx as Context<unknown>) as 'live' | 'default';
}

/**
 * Read the effective `$patch` batch behaviour from a captured context map
 * (typically `inst.capturedCtx`).
 * @internal
 */
export function _instanceBatch(
  capturedCtx: ReadonlyMap<Context<unknown>, unknown>,
): 'live' | 'default' {
  return _resolveCtxValue(capturedCtx, _batchCtx as Context<unknown>) as 'live' | 'default';
}

/**
 * Return a context map with the batch behaviour set to `batch`.
 * If the existing batch already matches, returns the same map (no allocation).
 * @internal
 */
export function _withBatch(
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
  batch: 'live' | 'default',
): ReadonlyMap<Context<unknown>, unknown> {
  if ((_resolveCtxValue(ctxMap, _batchCtx as Context<unknown>) as string) === batch) return ctxMap;
  const newMap = new Map(ctxMap);
  newMap.set(_batchCtx as Context<unknown>, batch);
  return newMap;
}
