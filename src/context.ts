import { useMemo, useRef } from "./hooks";
import { $USE_CONTEXT, type ContextDescriptor } from "./hooks/descriptors";
import type { ComponentGenerator, DependencyList } from "./hooks/types";
import { depsChanged } from "./hooks/types";
import {
  type Child,
  type Component,
  createElement,
  Fragment,
  type InternalProps,
  Provider,
  VNode,
} from "./jsx";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The return value of a Provider component's generator. */
export interface ProviderHandle<T = unknown> {
  ref: { current: T };
  subscribe: (callback: (value: T) => void) => () => void;
}

type ContextProvider<T> = (
  props: InternalProps & {
    value: T;
    $valueDeps?: DependencyList;
    children: Child[];
  },
  rerender: () => void,
) => ComponentGenerator<ProviderHandle<T>>;

/**
 * A context entry produced by calling a context object with a value.
 * Passed to the `$context` framework prop to provide context to a subtree.
 *
 * @example
 * const ThemeCtx = createContext<'light' | 'dark'>('light');
 * <Child $context={ThemeCtx('dark')} />
 */
export interface Context<T = unknown> extends ContextProvider<T> {
  readonly defaultValue: (() => T) | T;
  readonly provider: true;
  readonly identifier: symbol;
}

// ---------------------------------------------------------------------------
// Internal descriptor type for useContext (carries optional selector/transform)
// ---------------------------------------------------------------------------

/** @internal */
interface UseContextDescriptor {
  type: typeof $USE_CONTEXT;
  ctx: Context;
  selector?: (ctx: unknown) => unknown[];
  transform?: (...args: unknown[]) => unknown;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new context with a default value.
 *
 * Call the returned context with a value to produce a `ContextEntry`
 * for the `$context` prop. Use `useContext` to consume the value.
 *
 * @example
 * const ThemeCtx = createContext<'light' | 'dark'>('light');
 *
 * function* App() {
 *   const [theme] = yield* useState<'light' | 'dark'>('light');
 *   return <Child $context={ThemeCtx(theme)} />;
 * }
 *
 * function* Child() {
 *   const theme = yield* useContext(ThemeCtx);
 *   return <div className={theme}>hello</div>;
 * }
 */
export function createContext<T>(defaultValue: T): Context<T> {
  const ProviderComponent: ContextProvider<T> = function* ({
    value,
    $valueDeps = [value] as DependencyList,
  }) {
    const ref = yield* useRef(value);
    ref.current = value;

    const subscribers = yield* useMemo(() => new Set<(value: T) => void>(), []);
    const subscribe = yield* useMemo(
      () =>
        (callback: (value: T) => void): (() => void) => {
          subscribers.add(callback);
          return () => {
            subscribers.delete(callback);
          };
        },
      [],
    );

    // Notify subscribers when value changes
    yield* useMemo(
      () => {
        for (const callback of subscribers) callback(value);
      },
      $valueDeps as [],
    );

    return { ref, subscribe };
  };
  return Object.assign(ProviderComponent, {
    defaultValue,
    provider: true,
    identifier: Symbol("Context"),
  });
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
    ctx: ctx as Context,
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
  ctx: Context;
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
export function processContext(
  descriptor: ContextDescriptor,
  prev: UseContextState | undefined,
  rawValue: unknown,
): UseContextState {
  const context = descriptor.ctx as Context;
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
 * context's `defaultValue` when no Provider has supplied a value.
 *
 * TODO: eliminate in favor of `yield* getContext()` in generator code.
 * Kept for synchronous code that cannot yield (hooks, helpers, scheduler).
 * @internal
 */
export function resolveCtx<T>(map: ReadonlyMap<Context<any>, unknown>, ctx: Context<T>): T {
  return (map.has(ctx) ? map.get(ctx) : ctx.defaultValue) as T;
}
