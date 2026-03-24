import { $USE_CONTEXT, $USE_SET_CONTEXT, type ContextDescriptor } from "./hooks/descriptors";
import type { ComponentGenerator } from "./hooks/types";
import { depsChanged } from "./hooks/types";
import { type Child, type Component, createElement, Fragment, type InternalProps } from "./jsx";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A context object. Holds only the default value.
 *
 * Internal contexts (like `BatchContext` and `PriorityContext`) use this
 * minimal shape — they have no Provider component.
 */
export interface Context<T> {
  readonly _defaultValue: T;
}

/**
 * A context object returned by `createContext`.
 * Use `Context.Provider` to supply a value, `useContext` to consume it.
 *
 * Extends the minimal `Context<T>` with a `Provider` symbol that can be
 * used as a VNode type in JSX.
 */
export interface PublicContext<T> extends Context<T> {
  readonly Provider: Component<InternalProps & { value: T; children?: Child[] }>;
}

// ---------------------------------------------------------------------------
// Internal descriptor type for useContext (carries optional selector/transform)
// ---------------------------------------------------------------------------

/** @internal */
interface UseContextDescriptor {
  type: typeof $USE_CONTEXT;
  ctx: Context<unknown>;
  selector?: (ctx: unknown) => unknown[];
  transform?: (...args: unknown[]) => unknown;
}

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
export function createContext<T>(defaultValue: T): PublicContext<T> {
  const ctx: PublicContext<T> = {
    _defaultValue: defaultValue,
    Provider: undefined as never,
  };

  function* ContextProvider(
    props: InternalProps & { value: T; children?: Child[] },
  ): ComponentGenerator<Child> {
    yield { type: $USE_SET_CONTEXT, ctx, value: props.value };
    return createElement(Fragment, null, ...(props.children ?? []));
  }

  (ctx as { Provider: Component<InternalProps & { value: T; children?: Child[] }> }).Provider =
    ContextProvider;

  return ctx;
}

/**
 * Consume a context value inside a component.
 * Must be called with `yield*` inside a component or hook.
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
export function useContext<T>(ctx: Context<T>): ComponentGenerator<T>;
export function useContext<T>(
  ctx: Context<T>,
  selector: (ctx: T) => unknown[],
): ComponentGenerator<T>;
export function useContext<T, D extends unknown[], R>(
  ctx: Context<T>,
  selector: (ctx: T) => D,
  transform: (...args: D) => R,
): ComponentGenerator<R>;
export function* useContext<T, D extends unknown[], R>(
  ctx: Context<T>,
  selector?: (ctx: T) => D,
  transform?: (...args: D) => R,
): ComponentGenerator<T | R> {
  const value = yield {
    type: $USE_CONTEXT,
    ctx: ctx as Context<unknown>,
    selector: selector as UseContextDescriptor["selector"],
    transform: transform as UseContextDescriptor["transform"],
  };
  return value as T | R;
}

// ---------------------------------------------------------------------------
// UseContext hook state & handler
// ---------------------------------------------------------------------------

/**
 * Persistent hook state stored for a `useContext` call.
 *
 * Stored in `ComponentInstance.hookStates[hookIndex]` for each `useContext` hook.
 * The reconciler reads these entries to determine whether a context change
 * requires a rerender (by checking `selector` and `lastDeps`).
 *
 * @internal
 */
export type UseContextState = {
  kind: typeof $USE_CONTEXT;
  /** The context object this hook subscribes to. */
  ctx: Context<unknown>;
  /** Optional selector function — extracts deps from the context value. */
  selector?: (ctx: unknown) => unknown[];
  /** Optional transform function — computes the returned value from deps. */
  transform?: (...args: unknown[]) => unknown;
  /** The last computed deps array (from `selector`). Used by `depsChanged`. */
  lastDeps?: unknown[];
  /** The last returned value (raw context value, or `transform(…deps)`). */
  lastResult: unknown;
};

/** @internal */
export function _processContext(
  descriptor: ContextDescriptor,
  prev: UseContextState | undefined,
  rawValue: unknown,
): UseContextState {
  const context = descriptor.ctx as Context<unknown>;
  const selector = descriptor.selector as UseContextDescriptor["selector"];
  const transform = descriptor.transform as UseContextDescriptor["transform"];

  if (!selector) {
    return { kind: $USE_CONTEXT, ctx: context, lastResult: rawValue };
  }

  const newDeps = selector(rawValue);
  if (prev?.selector && !depsChanged(prev.lastDeps, newDeps)) {
    return prev;
  }
  const result = transform ? transform(...newDeps) : rawValue;
  return {
    kind: $USE_CONTEXT,
    ctx: context,
    selector,
    transform,
    lastDeps: newDeps,
    lastResult: result,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers used by the renderer
// ---------------------------------------------------------------------------

/**
 * Resolve the effective value for `ctx` from `map`, falling back to the
 * context's `_defaultValue` when no Provider has supplied a value.
 *
 * TODO: eliminate in favor of `yield* getContext()` in generator code.
 * Kept for synchronous code that cannot yield (hooks, helpers, scheduler).
 * @internal
 */
export function _resolveCtxValue<T>(
  map: ReadonlyMap<Context<unknown>, unknown>,
  ctx: Context<T>,
): T {
  return (map.has(ctx) ? map.get(ctx) : ctx._defaultValue) as T;
}

// ---------------------------------------------------------------------------
// Internal batch context – propagates `$patch` behaviour through ctxMap
// ---------------------------------------------------------------------------

/**
 * Internal context for the `$patch` batch behaviour.
 * Used by the renderer to propagate `$patch` through the context map,
 * just like application-level contexts.
 *
 * @internal
 */
export const BatchContext: Context<"live" | "default"> = {
  _defaultValue: "default",
};

/**
 * Read the effective `$patch` batch behaviour from a captured context map
 * (typically `inst.capturedCtx`).
 * @internal
 */
export function _instanceBatch(
  capturedCtx: ReadonlyMap<Context<unknown>, unknown>,
): "live" | "default" {
  return _resolveCtxValue(capturedCtx, BatchContext);
}

/**
 * Return a context map with the batch behaviour set to `batch`.
 * If the existing batch already matches, returns the same map (no allocation).
 * @internal
 */
export function _withBatch(
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
  batch: "live" | "default",
): ReadonlyMap<Context<unknown>, unknown> {
  if (_resolveCtxValue(ctxMap, BatchContext) === batch) return ctxMap;
  const newMap = new Map(ctxMap);
  newMap.set(BatchContext, batch);
  return newMap;
}

// ---------------------------------------------------------------------------
// Internal priority context – propagates `$deferred` priority through ctxMap
// ---------------------------------------------------------------------------

/**
 * Internal context for the `$deferred` priority level.
 * Used by the renderer to propagate `$deferred` through the context map,
 * just like application-level contexts.
 *
 * The default priority is 0 (highest priority). Each `$deferred={true}`
 * increments the priority by 1.
 *
 * @internal
 */
export const PriorityContext: Context<number> = {
  _defaultValue: 0,
};

/**
 * Return a context map with the priority set to `priority`.
 * If the existing priority already matches, returns the same map (no allocation).
 * @internal
 */
export function _withPriority(
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
  priority: number,
): ReadonlyMap<Context<unknown>, unknown> {
  if (_resolveCtxValue(ctxMap, PriorityContext) === priority) return ctxMap;
  const newMap = new Map(ctxMap);
  newMap.set(PriorityContext, priority);
  return newMap;
}
