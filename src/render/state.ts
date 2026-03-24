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

const $GET_CONTEXT = Symbol("GET_CONTEXT");
const $SET_CONTEXT = Symbol("SET_CONTEXT");
const $GET_CONTEXT_MAP = Symbol("GET_CONTEXT_MAP");

type ContextDescriptor =
  | { readonly op: typeof $GET_CONTEXT; readonly key: { readonly _defaultValue: unknown } }
  | {
      readonly op: typeof $SET_CONTEXT;
      readonly key: { readonly _defaultValue: unknown };
      readonly value: unknown;
    }
  | { readonly op: typeof $GET_CONTEXT_MAP };

/**
 * A generator that participates in the context system.
 * Yields context descriptors and ultimately returns `TReturn`.
 * @internal
 */
export type ContextGenerator<TReturn> = Generator<ContextDescriptor, TReturn, unknown>;

/**
 * Yield from a generator to read the current value of a context.
 * @internal
 */
export function* getContext<T>(ctx: { readonly _defaultValue: T }): ContextGenerator<T> {
  return (yield { op: $GET_CONTEXT, key: ctx }) as T;
}

/**
 * Yield from a generator to set a context value for the current subtree.
 * @internal
 */
export function* setContext<T>(
  ctx: { readonly _defaultValue: T },
  value: T,
): ContextGenerator<void> {
  yield { op: $SET_CONTEXT, key: ctx, value };
}

/**
 * Yield from a generator to get the full current context map.
 * @internal
 */
export function* getContextMap(): ContextGenerator<ReadonlyMap<object, unknown>> {
  return (yield { op: $GET_CONTEXT_MAP }) as ReadonlyMap<object, unknown>;
}

/**
 * Drive a context generator, resolving get/set/getMap descriptors.
 * @internal
 */
export function runWithContext<T>(
  ctxMap: ReadonlyMap<object, unknown>,
  gen: ContextGenerator<T>,
): T {
  let currentMap = ctxMap;
  let result = gen.next();
  while (!result.done) {
    const desc = result.value;
    if (desc.op === $GET_CONTEXT) {
      const value = currentMap.has(desc.key) ? currentMap.get(desc.key) : desc.key._defaultValue;
      result = gen.next(value);
    } else if (desc.op === $SET_CONTEXT) {
      const newMap = new Map(currentMap);
      newMap.set(desc.key, desc.value);
      currentMap = newMap;
      result = gen.next(undefined);
    } else {
      result = gen.next(currentMap);
    }
  }
  return result.value;
}
