import type { Context } from "../context";
import type { RenderContext } from "./types";

// ── RenderCtx — context key for the per-root RenderContext ───────────────
//
// This is a plain context key
// stored in the ctxMap so that generators can access the render context
// via `yield* getContextMap()` + `resolveCtx(ctxMap, RenderCtx)`
// instead of relying on the module-level `activeRenderCtx` pointer.
//
// It has no Provider component — the render entry points set it directly
// in the initial ctxMap passed to `drive()`.

/**
 * Context key for the per-root `RenderContext`.
 *
 * Set by `render()` / `createRoot()` in the initial ctxMap. Read by
 * generator code (mount, reconciler) via `resolveCtx(ctxMap, RenderCtx)`.
 *
 * @internal
 */
export const RenderCtx: Context<RenderContext> = {
  defaultValue: undefined as never,
};

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
    isInitialMount: false,
    pendingUpdates: new Set(),
    isProcessing: false,
    syncMode: true,
  };
}

// ── Active render context pointer (synchronous leaf code only) ───────────
//
// Generator code (mount.ts, reconciler.ts) accesses the RenderContext via
// the ctxMap (`resolveCtx(ctxMap, RenderCtx)`). This module-level
// pointer exists solely for synchronous leaf functions (commit-queue.ts,
// props.ts, patch.ts) that cannot yield into the driver to read the ctxMap.
//
// `drive()` sets `activeRenderCtx` from the ctxMap at the start of each call,
// so the value is always fresh during generator execution.

let activeRenderCtx: RenderContext | undefined;

/**
 * Return the currently active render context.
 *
 * **Precondition:** Must only be called while a rendering operation is in
 * progress (i.e. `setActiveRenderCtx` was called with a defined context).
 * @internal
 */
export function requireActiveRenderCtx(): RenderContext {
  if (!activeRenderCtx) {
    throw new Error(
      "No active render context — requireActiveRenderCtx called outside a render pass",
    );
  }
  return activeRenderCtx;
}

/**
 * Set (or clear) the active render context.
 *
 * Used by synchronous leaf code that cannot access the ctxMap via the
 * generator driver (commit-queue, props, patch, scheduler, dispatch).
 *
 * **Called by:**
 * - `drive()` in `driver.ts` — reads `RenderCtx` from the ctxMap and sets
 *   `activeRenderCtx` so synchronous helpers invoked during generation have access.
 * - `scheduleUpdate` / `_runLoop` in `scheduler.ts` — before processing work.
 * - `_yieldToBrowser` in `scheduler.ts` — on resume after yield.
 * - `dispatchDelegatedEvent` in `dispatch.ts` — before dispatching events.
 * @internal
 */
export function setActiveRenderCtx(ctx: RenderContext | undefined): void {
  activeRenderCtx = ctx;
}
