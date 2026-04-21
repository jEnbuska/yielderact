import type { ComponentGenerator } from "./hooks/types";
import type { Child, PropsWithChildren } from "./jsx";

export const ContextSymbol: unique symbol = Symbol("Context");

/**
 * Props accepted by a Context provider VNode: `<Ctx value={v}>{kids}</Ctx>`.
 *
 * Extends `PropsWithChildren` so a provider always wraps something — a
 * provider with no children is rejected at the JSX validation level.
 */
export interface ContextProviderProps<T = unknown> extends PropsWithChildren {
  value: T;
}

/**
 * A context object, usable directly as a JSX provider:
 *
 * ```tsx
 * const ThemeCtx = createContext<'light' | 'dark'>('light');
 * <ThemeCtx value="dark">{kids}</ThemeCtx>
 * ```
 */
export interface Context<T = any> {
  (props: ContextProviderProps<T>): ComponentGenerator<Child>;
  readonly defaultValue: T;
  readonly [ContextSymbol]: true;
}

export function isContext(value: unknown): value is Context {
  return (
    typeof value === "function" && (value as { [ContextSymbol]?: true })[ContextSymbol] === true
  );
}

/**
 * Create a new context with a default value.
 *
 * The returned object is callable as a JSX provider (`<Ctx value={v}>{k}</Ctx>`)
 * and doubles as the hook key for `context(Ctx)` consumers. The placeholder
 * function body is never invoked — `ContextInstance` handles providers
 * directly based on the `ContextSymbol` marker.
 */
export function createContext<T>(defaultValue: T): Context<T> {
  const Context = function* (_: ContextProviderProps<T>): ComponentGenerator<Child> {
    return null;
  };
  return Object.assign(Context, {
    defaultValue,
    [ContextSymbol]: true,
  }) as unknown as Context<T>;
}

// ---------------------------------------------------------------------------
// ContextHandle — installed in the ContextMap by ContextInstance.
//
// The handle identity is stable for the provider's entire lifetime:
//   - `ref.current` holds the latest value, read by consumers on each render
//   - `subscribe(cb)` registers a push notification fired on value changes
// Because the handle is stable, the ContextMap entry set at mount time
// stays valid forever — no mutation, no tree walking, no re-propagation.
// ---------------------------------------------------------------------------

export interface ContextHandle<T = unknown> {
  ref: { current: T };
  subscribe: (cb: () => void) => () => void;
}

/**
 * Look up the live value for `ctx`, falling back to its `defaultValue`.
 */
export function resolveCtxValue<T>(
  map: ReadonlyMap<Context, unknown> | undefined,
  ctx: Context<T>,
): T {
  const handle = map?.get(ctx) as ContextHandle<T> | undefined;
  if (!handle) return ctx.defaultValue;
  return handle.ref.current;
}

// ---------------------------------------------------------------------------
// context consumer hook
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// context hook state — uses reason-symbol scheduling to coalesce/cancel
// multiple context subscriptions on the same instance.
// ---------------------------------------------------------------------------
