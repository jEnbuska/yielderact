import type { RenderContext } from "./types";

/**
 * Create a fresh per-root render context.
 *
 * Each `render()` or `createRoot()` call creates its own context so that
 * independent roots do not share mutable state.
 *
 * **Called by:** `render()` and `createRoot()` in `index.ts`.
 */
export function createRenderContext(): RenderContext {
  return {
    patchDepth: 0,
    dirtyInstances: new Set(),
    isInitialMount: false,
    liveOnlyMode: false,
    pendingUpdates: new Map(),
    isProcessing: false,
    syncMode: true,
  };
}

// ── Active render context pointer ─────────────────────────────────────────
//
// During any rendering work (mount, rerender, reconciliation, effect flush),
// the "active" context is set to the root's `RenderContext`. All internal
// modules read/write through this pointer instead of module-level variables.

let _activeCtx: RenderContext | undefined;

/**
 * Return the currently active render context.
 *
 * **Precondition:** Must only be called while a rendering operation is in
 * progress (i.e. `_setActiveCtx` was called with a defined context).
 * @internal
 */
export function _requireActiveCtx(): RenderContext {
  if (!_activeCtx) {
    throw new Error("No active render context — _requireActiveCtx called outside a render pass");
  }
  return _activeCtx;
}

/**
 * Set (or clear) the active render context.
 *
 * **Called by:**
 * - `render()` / `createRoot().render()` — before initial mount.
 * - `scheduleUpdate` / `_runLoop` in `scheduler.ts` — before processing work.
 * - `_yieldToBrowser` in `scheduler.ts` — on resume after yield.
 * - `rerender()` / `resume()` closures in `mount.ts` — before accessing
 *   context-dependent state from event handlers.
 * @internal
 */
export function _setActiveCtx(ctx: RenderContext | undefined): void {
  _activeCtx = ctx;
}

// ── Generator-based context system ────────────────────────────────────────

const $SET_CONTEXT = Symbol("SET_CONTEXT");
const $GET_CONTEXT_MAP = Symbol("GET_CONTEXT_MAP");

type ContextDescriptor<T = unknown> =
  | {
      readonly op: typeof $SET_CONTEXT;
      readonly key: { readonly _defaultValue: T };
      readonly updater: (current: T) => T;
    }
  | { readonly op: typeof $GET_CONTEXT_MAP };

/**
 * A generator that participates in the context system.
 * Yields context descriptors and ultimately returns `TReturn`.
 * @internal
 */
export type ContextGenerator<TReturn> = Generator<ContextDescriptor, TReturn, unknown>;

/**
 * Yield from a generator to set a context value for the current subtree.
 * @internal
 */
export function* setContext<T>(
  ctx: { readonly _defaultValue: T },
  updater: (current: T) => T,
): ContextGenerator<void> {
  yield { op: $SET_CONTEXT, key: ctx, updater: updater as (current: unknown) => unknown };
}

/**
 * Yield from a generator to get the full current context map.
 * @internal
 */
export function* getContextMap(): ContextGenerator<
  ReadonlyMap<{ readonly _defaultValue: unknown }, unknown>
> {
  return (yield { op: $GET_CONTEXT_MAP }) as ReadonlyMap<
    { readonly _defaultValue: unknown },
    unknown
  >;
}

/**
 * Drive a context generator, resolving get/set/getMap descriptors.
 * @internal
 */
export function runWithContext<T>(
  ctxMap: ReadonlyMap<{ readonly _defaultValue: unknown }, unknown>,
  gen: ContextGenerator<T>,
): T {
  const ctx = { current: ctxMap };
  let result = gen.next();
  while (!result.done) {
    const handled = handleContextYield(result.value, ctx);
    result = gen.next(handled.sendBack);
  }
  return result.value;
}

/**
 * Process a yielded value that may be a context descriptor.
 *
 * Handles `$SET_CONTEXT` and `$GET_CONTEXT_MAP` ops by updating/reading
 * the mutable context map wrapper. For `void` yields (scheduling pauses)
 * or other values, returns `undefined` as sendBack.
 *
 * @internal
 */
export function handleContextYield(
  value: unknown,
  ctx: { current: ReadonlyMap<{ readonly _defaultValue: unknown }, unknown> },
): { sendBack: unknown } {
  if (value === null || value === undefined || typeof value !== "object") {
    return { sendBack: undefined };
  }
  const desc = value as { op?: symbol };
  if (desc.op === $SET_CONTEXT) {
    const d = value as ContextDescriptor & { op: typeof $SET_CONTEXT };
    const current = ctx.current.has(d.key) ? ctx.current.get(d.key) : d.key._defaultValue;
    const newMap = new Map(ctx.current);
    newMap.set(d.key, d.updater(current));
    ctx.current = newMap;
    return { sendBack: undefined };
  }
  if (desc.op === $GET_CONTEXT_MAP) {
    return { sendBack: ctx.current };
  }
  return { sendBack: undefined };
}
