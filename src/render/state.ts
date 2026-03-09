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
    renderingPriority: null,
    ctxMap: new Map(),
    ops: null,
    pendingUpdates: new Map(),
    isProcessing: false,
    activePriority: null,
    syncMode: true,
  };
}

// ── Active render context pointer ─────────────────────────────────────────
//
// During any rendering work (mount, rerender, reconciliation, effect flush),
// the "active" context is set to the root's `RenderContext`. All internal
// modules read/write through this pointer instead of module-level variables.

let _activeCtx: RenderContext | null = null;

/**
 * Return the currently active render context, or `null` if none is active.
 *
 * Most call sites use this during a render pass (where the return is
 * guaranteed non-null). The nullable return is needed for save/restore
 * patterns at entry points (`render()`, `createRoot().render()`).
 * @internal
 */
export function _getActiveCtx(): RenderContext | null {
  return _activeCtx;
}

/**
 * Return the currently active render context.
 *
 * **Precondition:** Must only be called while a rendering operation is in
 * progress (i.e. `_setActiveCtx` was called with a non-null context).
 * @internal
 */
export function _requireActiveCtx(): RenderContext {
  return _activeCtx!;
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
export function _setActiveCtx(ctx: RenderContext | null): void {
  _activeCtx = ctx;
}

// ── Global ID counter ─────────────────────────────────────────────────────
//
// Unique IDs must be globally unique across all roots, so the counter stays
// module-level rather than per-root.

/**
 * Auto-incrementing counter for stable unique IDs produced by `$id`.
 *
 * Incremented by `_processId` in `hooks/$id.ts`. Each `$id()` call gets
 * `":r<N>:"` where N is the counter value at first mount.
 */
export let idCounter = 0;

/** Allocate the next unique ID string. @internal */
export function nextId(): string {
  return `:r${idCounter++}:`;
}
