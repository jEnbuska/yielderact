import { $USE_CONTEXT, type ContextDescriptor } from "./hooks/descriptors";
import type { ComponentGenerator } from "./hooks/types";
import { depsChanged } from "./hooks/types";
import {
  type Child,
  type Component,
  createElement,
  Fragment,
  type InternalProps,
  type VNode,
} from "./jsx";
import { _requireActiveCtx } from "./render/state";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A context object returned by `createContext`.
 * Use `Context.Provider` to supply a value, `useContext` to consume it.
 */
export interface Context<T> {
  readonly _defaultValue: T;
  readonly Provider: Component<InternalProps & { value: T; children?: Child[] }>;
}

// ---------------------------------------------------------------------------
// Provider function type — the actual callable form of Context.Provider
// ---------------------------------------------------------------------------

/**
 * The actual callable signature of a context Provider function.
 *
 * Provider functions are stored as `Component` on the `Context` interface
 * (so they can appear in JSX), but at runtime they are plain functions
 * that return a VNode (not generators). This type represents their true
 * runtime signature.
 *
 * @internal
 */
type ProviderFunction = (props: InternalProps) => VNode | null | undefined;

// ---------------------------------------------------------------------------
// Internal symbols used to tag Provider functions
// ---------------------------------------------------------------------------

const PROVIDER_CTX = Symbol("providerCtx");

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
// Context map — stored on the active RenderContext, accessed via helpers
// ---------------------------------------------------------------------------

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
    Provider: ContextProvider as unknown as Component<
      InternalProps & {
        value: T;
        children?: Child[];
      }
    >,
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

/** Get the current context map from the active render context. */
export function _getCtxMap(): ReadonlyMap<Context<unknown>, unknown> {
  return _requireActiveCtx().ctxMap;
}

/** Set the context map on the active render context. */
export function _setCtxMap(map: ReadonlyMap<Context<unknown>, unknown>): void {
  _requireActiveCtx().ctxMap = map;
}

/**
 * If `fn` is a context Provider function, return the matching Context object.
 * Otherwise return `null`.
 */
export function _getProviderCtx(fn: unknown): Context<unknown> | null {
  return ((fn as Record<symbol, unknown>)?.[PROVIDER_CTX] as Context<unknown>) ?? null;
}

/**
 * Cast a `Component` that is known to be a Provider to its actual callable form.
 *
 * Provider functions are stored with the `Component` type (so they can appear
 * in JSX) but at runtime they are plain functions, not generators.
 * This helper centralises the unsafe cast so call sites remain clean.
 *
 * @internal
 */
export function _asProviderFn(component: Component): ProviderFunction {
  return component as unknown as ProviderFunction;
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
export const _batchCtx: Context<"live" | "default"> = {
  _defaultValue: "default",
  Provider: undefined as never,
};

/**
 * Read the current `$patch` batch behaviour from the active context map.
 * Falls back to `'default'` when no `createRoot` or `$patch` ancestor has set it.
 * @internal
 */
export function _getCurrentBatch(): "live" | "default" {
  return _resolveCtxValue(_requireActiveCtx().ctxMap, _batchCtx as Context<unknown>) as
    | "live"
    | "default";
}

/**
 * Read the effective `$patch` batch behaviour from a captured context map
 * (typically `inst.capturedCtx`).
 * @internal
 */
export function _instanceBatch(
  capturedCtx: ReadonlyMap<Context<unknown>, unknown>,
): "live" | "default" {
  return _resolveCtxValue(capturedCtx, _batchCtx as Context<unknown>) as "live" | "default";
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
  if ((_resolveCtxValue(ctxMap, _batchCtx as Context<unknown>) as string) === batch) return ctxMap;
  const newMap = new Map(ctxMap);
  newMap.set(_batchCtx as Context<unknown>, batch);
  return newMap;
}

// ---------------------------------------------------------------------------
// Internal priority context – propagates `$deferred` priority through _ctxMap
// ---------------------------------------------------------------------------

/**
 * Internal context for the `$deferred` priority level.
 * Not exported publicly — used only by the renderer to propagate `$deferred`
 * through the context map, just like application-level contexts.
 *
 * The default priority is 0 (highest priority). Each `$deferred={true}`
 * increments the priority by 1.
 *
 * @internal
 */
const _priorityCtx: Context<number> = {
  _defaultValue: 0,
  Provider: undefined as never,
};

/**
 * Read the current `$deferred` priority level from the active context map.
 * Falls back to `0` when no `$deferred` ancestor has set it.
 * @internal
 */
export function _getCurrentPriority(): number {
  return _resolveCtxValue(_requireActiveCtx().ctxMap, _priorityCtx as Context<unknown>) as number;
}

/**
 * Return a context map with the priority set to `priority`.
 * If the existing priority already matches, returns the same map (no allocation).
 * @internal
 */
export function _withPriority(
  ctxMap: ReadonlyMap<Context<unknown>, unknown>,
  priority: number,
): ReadonlyMap<Context<unknown>, unknown> {
  if ((_resolveCtxValue(ctxMap, _priorityCtx as Context<unknown>) as number) === priority)
    return ctxMap;
  const newMap = new Map(ctxMap);
  newMap.set(_priorityCtx as Context<unknown>, priority);
  return newMap;
}
