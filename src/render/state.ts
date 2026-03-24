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
