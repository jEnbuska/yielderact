/**
 * scheduler.ts — Cooperative scheduler for rendering.
 *
 * All rendering work after initial mount flows through the scheduler.
 * Work is submitted via `scheduleWork(gen, ctxMap)` or
 * `scheduleUpdate(instance)` and processed in batches.
 *
 * The scheduler drives generators step-by-step, handling context ops
 * via `driveWithContext` and checking time budgets between yields.
 *
 * **Time-slicing (async mode):** The scheduler yields to the browser
 * every ~5ms via `MessageChannel`, keeping the UI responsive.
 *
 * **Sync mode** (default): The work loop runs to completion without
 * yielding, preserving synchronous rendering for tests and simple apps.
 */

import type { Context } from "../context";
import { resolveCtx } from "../context";
import { beginBatch, commitBatch } from "./commit-queue";
import { driveWithContext, type RenderGenerator } from "./driver";
import { RenderCtx, requireActiveRenderCtx, setActiveRenderCtx } from "./state";
import type { ComponentInstance, RenderContext } from "./types";

/** Time budget per work chunk in milliseconds. */
const timeSlice = 5;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Submit a generator as work to the scheduler.
 *
 * The generator is immediately wrapped with `driveWithContext` so context
 * ops are handled transparently. The scheduler steps through the wrapped
 * generator, checking time budgets between yields.
 *
 * If the scheduler isn't running, it starts.
 */
export function scheduleWork(
  gen: RenderGenerator<void>,
  ctxMap: ReadonlyMap<Context, unknown>,
): void {
  const rctx = resolveCtx(ctxMap, RenderCtx);
  rctx.workQueue.push(driveWithContext(ctxMap, gen));

  if (!rctx.isProcessing) {
    rctx.isProcessing = true;
    setActiveRenderCtx(rctx);
    runLoop(rctx);
  }
}

/**
 * Schedule a rerender for `instance`.
 *
 * Creates the rerender generator and submits it to the scheduler.
 *
 * @param instance - The ComponentInstance to rerender.
 */
export function scheduleUpdate(instance: ComponentInstance): void {
  const rctx = resolveCtx(instance.capturedCtx, RenderCtx);
  rctx.pendingUpdates.add(instance);

  if (!rctx.isProcessing) {
    rctx.isProcessing = true;
    setActiveRenderCtx(rctx);
    runLoop(rctx);
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
  const rctx = requireActiveRenderCtx();
  const { syncMode: prevSync } = rctx;
  rctx.syncMode = true;

  if (fn) {
    const { isProcessing: wasProcessing } = rctx;
    rctx.isProcessing = true;
    try {
      fn();
    } finally {
      rctx.isProcessing = wasProcessing;
    }
  }

  if (!rctx.isProcessing && hasPendingWork(rctx)) {
    rctx.isProcessing = true;
    runLoop(rctx);
  }

  rctx.syncMode = prevSync;
}

/**
 * Flush any pending work for a specific render context.
 *
 * Called by the event dispatch system after a delegated event has been
 * fully dispatched.
 *
 * @internal
 */
export function flushPendingWork(rctx: RenderContext): void {
  if (hasPendingWork(rctx)) {
    setActiveRenderCtx(rctx);
    rctx.isProcessing = true;
    runLoop(rctx);
  }
}

// ── Internal ─────────────────────────────────────────────────────────────────

function hasPendingWork(rctx: RenderContext): boolean {
  return rctx.pendingUpdates.size > 0 || rctx.workQueue.length > 0;
}

/**
 * Drain `pendingUpdates` into `workQueue` by calling each instance's
 * `executeRerender()` which now pushes a generator onto the work queue.
 */
function drainPendingUpdates(rctx: RenderContext): void {
  if (rctx.pendingUpdates.size === 0) return;
  const instances = [...rctx.pendingUpdates];
  rctx.pendingUpdates.clear();
  for (const instance of instances) {
    instance.executeRerender();
  }
}

// ── Work loop ────────────────────────────────────────────────────────────────

/**
 * The main work loop. Processes all work items by stepping through
 * generators one yield at a time, checking the time budget between steps.
 *
 * DOM mutations are collected via `beginBatch()`/`commitBatch()` for
 * atomic commits.
 */
function runLoop(rctx: RenderContext): void {
  const deadline = performance.now() + timeSlice;

  beginBatch();

  while (true) {
    // Convert pending instance updates into work items.
    drainPendingUpdates(rctx);

    if (rctx.workQueue.length === 0) break;

    // The generator is already wrapped with driveWithContext (done at
    // submission time in scheduleWork), so context ops are handled
    // transparently. We just step through it.
    const gen = rctx.workQueue[0] as Generator<unknown, void, unknown>;
    let result = gen.next();

    while (!result.done) {
      // Time-slicing: yield to browser if deadline exceeded.
      if (!rctx.syncMode && performance.now() >= deadline) {
        commitBatch();
        yieldToBrowser(rctx);
        return;
      }
      result = gen.next();
    }

    // This work item is done — remove it from the queue.
    rctx.workQueue.shift();
  }

  commitBatch();
  rctx.isProcessing = false;
}

/**
 * Yield to the browser, then resume the work loop.
 *
 * Uses `MessageChannel` for minimal-latency scheduling (same technique
 * as React's scheduler).
 */
function yieldToBrowser(rctx: RenderContext): void {
  if (typeof MessageChannel !== "undefined") {
    const mc = new MessageChannel();
    mc.port1.onmessage = () => {
      setActiveRenderCtx(rctx);
      runLoop(rctx);
    };
    mc.port2.postMessage(null);
  } else {
    setTimeout(() => {
      setActiveRenderCtx(rctx);
      runLoop(rctx);
    }, 0);
  }
}
