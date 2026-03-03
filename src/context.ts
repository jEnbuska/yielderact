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
 * function* App(_, rerender) {
 *   yield (
 *     <ThemeCtx.Provider value="dark">
 *       <Child />
 *     </ThemeCtx.Provider>
 *   );
 * }
 *
 * function* Child() {
 *   const theme = useContext(ThemeCtx);
 *   yield <div className={theme}>hello</div>;
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
 * Consume a context value inside a component.
 * Must be called during component rendering (before / after any yield).
 *
 * @example
 * function* Child() {
 *   const theme = useContext(ThemeCtx);
 *   while (true) {
 *     yield <div className={theme}>content</div>;
 *   }
 * }
 */
export function useContext<T>(ctx: Context<T>): T {
  const value = _ctxMap.get(ctx as Context<unknown>);
  return value !== undefined ? (value as T) : ctx._defaultValue;
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
  return (fn as Record<symbol, unknown>)?.[PROVIDER_CTX] as Context<unknown> ?? null;
}
