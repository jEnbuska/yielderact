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
  readonly Provider: (props: { value: T; children?: Child[] }) => VNode;
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
 *   const [theme] = yield* useState<'light' | 'dark'>('light');
 *   return (
 *     <ThemeCtx.Provider value={theme}>
 *       <Child />
 *     </ThemeCtx.Provider>
 *   );
 * }
 *
 * function* Child() {
 *   const theme = yield* useContext(ThemeCtx);
 *   return <div className={theme}>hello</div>;
 * }
 */
export function createContext<T>(defaultValue: T): Context<T> {
  // Build the Provider function first, then assemble the context object.
  // This avoids a `null!` placeholder.
  function ContextProvider(props: { value: T; children?: Child[] }): VNode {
    return createElement(Fragment, null, ...(props.children ?? []));
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
 * const ctx = yield* useContext(MyCtx);
 *
 * // 2. Rerenders only when currentGroup changes; returns full ctx
 * const { currentGroup } = yield* useContext(MyCtx, (c) => [c.currentGroup]);
 *
 * // 3. Rerenders only when currentGroup changes; returns the group directly
 * const group = yield* useContext(MyCtx, (c) => [c.currentGroup], (...args) => args[0]);
 */
export function useContext<T>(ctx: Context<T>): Generator<UseContextDescriptor, T, unknown>;
export function useContext<T>(
  ctx: Context<T>,
  selector: (ctx: T) => unknown[],
): Generator<UseContextDescriptor, T, unknown>;
export function useContext<T, D extends unknown[], R>(
  ctx: Context<T>,
  selector: (ctx: T) => D,
  transform: (...args: D) => R,
): Generator<UseContextDescriptor, R, unknown>;
export function* useContext<T, D extends unknown[], R>(
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
