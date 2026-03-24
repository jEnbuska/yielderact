/**
 * scheduler.ts — Priority-aware cooperative scheduler for rendering.
 *
 * Work is queued via `scheduleUpdate(instance)` which assigns a priority
 * based on whether we're inside a render (`renderCtx.renderingPriority`)
 * or idle (`instance.priority`).
 *
 * The scheduler processes work in strict priority order (lower number =
 * higher priority). Each priority level gets its own `beginPatch()`/
 * `commitPatch()` cycle so DOM mutations are applied atomically per level.
 *
 * **Preemption:** After processing each instance, the scheduler checks
 * whether higher-priority work has arrived. If so, it saves the current
 * priority's partial patch ops, processes all higher-priority levels to
 * completion, then resumes the original level.
 *
 * **Time-slicing (async mode):** The scheduler yields to the browser
 * every ~5ms via `MessageChannel`, keeping the UI responsive. On resume,
 * it checks for preemption before continuing.
 *
 * **Sync mode** (default): The work loop runs to completion without
 * yielding, preserving synchronous rendering for tests and simple apps.
 * Preemption still works in sync mode (higher-priority work triggered by
 * effects or context propagation is processed immediately).
 */

import { _resolveCtxValue, PriorityContext } from "../context";
import { beginPatch, commitPatch, restorePatchOps, savePatchOps } from "./patch-queue";
import { _requireActiveCtx, _setActiveCtx } from "./state";
import type { ComponentInstance, RenderContext } from "./types";

/** Time budget per work chunk in milliseconds. */
const _timeSlice = 5;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule a rerender for `instance` at the appropriate priority.
 *
 * Priority is determined by:
 * - During render (`renderCtx.renderingPriority` is set): caller's priority.
 * - During idle: the instance's own priority (`instance.priority`).
 *
 * If the scheduler is already processing, the instance is queued and will
 * be picked up by the running work loop (same priority = same batch,
 * higher priority = preemption at next check).
 *
 * @param instance - The ComponentInstance to rerender.
 */
export function scheduleUpdate(instance: ComponentInstance): void {
  const rctx = instance.renderCtx;
  const priority =
    rctx.renderingPriority ?? _resolveCtxValue(instance.capturedCtx, PriorityContext);

  let set = rctx.pendingUpdates.get(priority);
  if (!set) {
    set = new Set();
    rctx.pendingUpdates.set(priority, set);
  }
  set.add(instance);

  if (!rctx.isProcessing) {
    rctx.isProcessing = true;
    _setActiveCtx(rctx);
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
  const rctx = _requireActiveCtx();
  const prevSync = rctx.syncMode;
  rctx.syncMode = true;

  if (fn) {
    // Suppress immediate processing during fn so all setState calls batch.
    const wasProcessing = rctx.isProcessing;
    rctx.isProcessing = true;
    try {
      fn();
    } finally {
      rctx.isProcessing = wasProcessing;
    }
  }

  if (!rctx.isProcessing && _hasPendingWork(rctx)) {
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
  if (_hasPendingWork(rctx)) {
    _setActiveCtx(rctx);
    rctx.isProcessing = true;
    _runLoop(rctx);
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Returns true if any priority level has pending instances. */
function _hasPendingWork(rctx: RenderContext): boolean {
  for (const [, set] of rctx.pendingUpdates) {
    if (set.size > 0) return true;
  }
  return false;
}

/**
 * Returns the lowest priority number (= highest urgency) that has pending
 * work, or `undefined` if all queues are empty.
 */
function _getLowestPriority(rctx: RenderContext): number | undefined {
  let min: number | undefined;
  for (const [p, set] of rctx.pendingUpdates) {
    if (set.size > 0 && (min === undefined || p < min)) min = p;
  }
  return min;
}

/**
 * Returns the lowest priority number that is strictly less than `ceiling`
 * and has pending work. Used for preemption detection.
 */
function _getHigherPriorityThan(rctx: RenderContext, ceiling: number): number | undefined {
  let min: number | undefined;
  for (const [p, set] of rctx.pendingUpdates) {
    if (p < ceiling && set.size > 0 && (min === undefined || p < min)) min = p;
  }
  return min;
}

// ── Work loop ────────────────────────────────────────────────────────────────

/**
 * The main work loop. Processes priority levels from lowest number (highest
 * urgency) to highest number. Each level gets a `beginPatch()`/`commitPatch()`
 * cycle for atomic DOM commits.
 *
 * Handles:
 * - Resume after yield (continues partially-processed priority level).
 * - Preemption (higher-priority work processed inline).
 * - Time-slicing (yields to browser in async mode).
 */
function _runLoop(rctx: RenderContext): void {
  let deadline = performance.now() + _timeSlice;

  while (true) {
    let priority: number;

    if (rctx.activePriority !== undefined) {
      // Resuming a partially-processed priority level (after yield-to-browser).
      priority = rctx.activePriority;
    } else {
      const p = _getLowestPriority(rctx);
      if (p === undefined) {
        rctx.isProcessing = false;
        return;
      }
      priority = p;
      rctx.activePriority = priority;
      beginPatch();
    }

    // SAFETY: priority came from _getLowestPriority or activePriority — entry always exists
    const set = rctx.pendingUpdates.get(priority) as Set<ComponentInstance>;

    while (set.size > 0) {
      // SAFETY: set.size > 0 guarantees .next().value is defined
      const instance = set.values().next().value as ComponentInstance;
      set.delete(instance);

      instance._executeRerender();

      // Preemption: process any higher-priority work that arrived during rerender.
      _handlePreemption(rctx, priority);

      // Time-slicing (async mode only): yield to browser if deadline exceeded.
      if (!rctx.syncMode && set.size > 0 && performance.now() >= deadline) {
        _yieldToBrowser(rctx);
        return; // exit — the MessageChannel callback resumes via _runLoop
      }
    }

    // All instances at this priority level processed — commit the batch.
    commitPatch();
    rctx.pendingUpdates.delete(priority);
    rctx.activePriority = undefined;
    deadline = performance.now() + _timeSlice;
  }
}

/**
 * Process all pending work at priorities strictly higher (lower number) than
 * `currentPriority`. Saves and restores the current priority's patch ops
 * around each higher-priority level.
 *
 * Called after each instance rerender to detect and handle preemption.
 * Recurses to handle nested preemption (e.g., priority 0 work arrives
 * while processing priority 1 which preempted priority 2).
 */
function _handlePreemption(rctx: RenderContext, currentPriority: number): void {
  while (true) {
    const hp = _getHigherPriorityThan(rctx, currentPriority);
    if (hp === undefined) return;

    // Save current priority's partial patch ops.
    const savedOps = savePatchOps();

    // Process the higher-priority level fully.
    // SAFETY: hp came from _getHigherPriorityThan which checks set.size > 0
    const set = rctx.pendingUpdates.get(hp) as Set<ComponentInstance>;
    beginPatch();

    while (set.size > 0) {
      // SAFETY: set.size > 0 guarantees .next().value is defined
      const inst = set.values().next().value as ComponentInstance;
      set.delete(inst);
      inst._executeRerender();

      // Recursive preemption: even higher priority may have arrived.
      _handlePreemption(rctx, hp);
    }

    commitPatch();
    rctx.pendingUpdates.delete(hp);

    // Restore current priority's partial patch ops.
    restorePatchOps(savedOps);
  }
}

/**
 * Yield to the browser, then resume the work loop.
 *
 * Uses `MessageChannel` for minimal-latency scheduling (same technique
 * as React's scheduler). Saves and restores render state around
 * the yield so event handlers during the pause don't corrupt it.
 *
 * `rctx.activePriority` remains set so `_runLoop` knows to resume the
 * partially-processed priority level on callback.
 */
function _yieldToBrowser(rctx: RenderContext): void {
  // Save state that event handlers might disturb during the yield.
  const savedLiveOnlyMode = rctx.liveOnlyMode;

  if (typeof MessageChannel !== "undefined") {
    const mc = new MessageChannel();
    mc.port1.onmessage = () => {
      _setActiveCtx(rctx);
      rctx.liveOnlyMode = savedLiveOnlyMode;
      _runLoop(rctx);
    };
    mc.port2.postMessage(null);
  } else {
    // Fallback for environments without MessageChannel.
    setTimeout(() => {
      _setActiveCtx(rctx);
      rctx.liveOnlyMode = savedLiveOnlyMode;
      _runLoop(rctx);
    }, 0);
  }
}
