/**
 * scheduler.ts — Cooperative scheduler for rendering.
 *
 * Work is queued via `scheduleUpdate(instance)` which adds the instance
 * to a single pending set.
 *
 * The scheduler processes all pending work in a single
 * `beginPatch()`/`commitPatch()` cycle so DOM mutations are applied
 * atomically.
 *
 * **Time-slicing (async mode):** The scheduler yields to the browser
 * every ~5ms via `MessageChannel`, keeping the UI responsive.
 *
 * **Sync mode** (default): The work loop runs to completion without
 * yielding, preserving synchronous rendering for tests and simple apps.
 */

import { resolveCtx } from "../context";
import { beginPatch, commitPatch } from "./patch-queue";
import { RenderCtx, requireActiveCtx, setActiveCtx } from "./state";
import type { ComponentInstance, RenderContext } from "./types";

/** Time budget per work chunk in milliseconds. */
const _timeSlice = 5;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule a rerender for `instance`.
 *
 * If the scheduler is already processing, the instance is queued and will
 * be picked up by the running work loop.
 *
 * @param instance - The ComponentInstance to rerender.
 */
export function scheduleUpdate(instance: ComponentInstance): void {
  const rctx = resolveCtx(instance.capturedCtx, RenderCtx);

  rctx.pendingUpdates.add(instance);

  if (!rctx.isProcessing) {
    rctx.isProcessing = true;
    setActiveCtx(rctx);
    _runLoop(rctx);
  }
}

/**
 * Run all pending work synchronously, ignoring time slicing.
 *
 * Essential for tests and for event handlers that need immediate DOM
 * updates. Optionally accepts a function to execute before flushing
 * (e.g., a click that triggers a setState).
 *
 * During `fn`, processing is suppressed so multiple setState calls
 * are batched into a single processing pass.
 */
export function flushSync(fn?: () => void): void {
  const rctx = requireActiveCtx();
  const { syncMode: prevSync } = rctx;
  rctx.syncMode = true;

  if (fn) {
    // Suppress immediate processing during fn so all setState calls batch.
    const { isProcessing: wasProcessing } = rctx;
    rctx.isProcessing = true;
    try {
      fn();
    } finally {
      rctx.isProcessing = wasProcessing;
    }
  }

  if (!rctx.isProcessing && rctx.pendingUpdates.size > 0) {
    rctx.isProcessing = true;
    _runLoop(rctx);
  }

  rctx.syncMode = prevSync;
}

/**
 * Flush any pending work for a specific render context.
 *
 * Called by the event dispatch system after a delegated event has been
 * fully dispatched. Unlike `flushSync()`, this takes an explicit
 * `RenderContext` rather than reading the active context pointer, which
 * is important when an event handler in root A might have changed the
 * active context to root B.
 *
 * @internal
 */
export function _flushPendingWork(rctx: RenderContext): void {
  if (rctx.pendingUpdates.size > 0) {
    setActiveCtx(rctx);
    rctx.isProcessing = true;
    _runLoop(rctx);
  }
}

// ── Work loop ────────────────────────────────────────────────────────────────

/**
 * The main work loop. Processes all pending instances in a single
 * `beginPatch()`/`commitPatch()` cycle for atomic DOM commits.
 *
 * Handles:
 * - Resume after yield (continues partially-processed set).
 * - Time-slicing (yields to browser in async mode).
 */
function _runLoop(rctx: RenderContext): void {
  const deadline = performance.now() + _timeSlice;

  beginPatch();

  while (rctx.pendingUpdates.size > 0) {
    // SAFETY: size > 0 guarantees .next().value is defined
    const instance = rctx.pendingUpdates.values().next().value as ComponentInstance;
    rctx.pendingUpdates.delete(instance);

    void instance.executeRerender();

    // Time-slicing (async mode only): yield to browser if deadline exceeded.
    if (!rctx.syncMode && rctx.pendingUpdates.size > 0 && performance.now() >= deadline) {
      commitPatch();
      _yieldToBrowser(rctx);
      return; // exit — the MessageChannel callback resumes via _runLoop
    }
  }

  // All instances processed — commit the batch.
  commitPatch();
  rctx.isProcessing = false;
}

/**
 * Yield to the browser, then resume the work loop.
 *
 * Uses `MessageChannel` for minimal-latency scheduling (same technique
 * as React's scheduler).
 */
function _yieldToBrowser(rctx: RenderContext): void {
  if (typeof MessageChannel !== "undefined") {
    const mc = new MessageChannel();
    mc.port1.onmessage = () => {
      setActiveCtx(rctx);
      _runLoop(rctx);
    };
    mc.port2.postMessage(null);
  } else {
    // Fallback for environments without MessageChannel.
    setTimeout(() => {
      setActiveCtx(rctx);
      _runLoop(rctx);
    }, 0);
  }
}
