/**
 * scheduler.ts — Priority-aware cooperative scheduler for rendering.
 *
 * Work is queued via `scheduleUpdate(instance)` which assigns a priority
 * based on whether we're inside a render (`renderState.renderingPriority`)
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

import { _getCtxMap, _setCtxMap } from '../context';
import { renderState } from './state';
import { beginPatch, commitPatch, savePatchOps, restorePatchOps } from './patch-queue';
import type { GenInstance } from './types';

// ── Scheduler state ──────────────────────────────────────────────────────────

/**
 * Priority queue: maps priority level → set of instances needing update.
 * Lower numbers are higher priority (processed first).
 */
const _pendingUpdates = new Map<number, Set<GenInstance>>();

/** True while the scheduler is actively processing work. */
let _isProcessing = false;

/**
 * The priority level currently being processed (beginPatch called, not yet
 * committed). `null` when idle or between priority levels.
 *
 * Used to detect resume-after-yield: if non-null when `_runLoop` starts,
 * we're continuing a partially-processed level (don't call `beginPatch` again).
 */
let _activePriority: number | null = null;

/** When true, the work loop never yields to the browser. */
let _syncMode = true;

/** Time budget per work chunk in milliseconds. */
let _timeSlice = 5;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule a rerender for `instance` at the appropriate priority.
 *
 * Priority is determined by:
 * - During render (`renderState.renderingPriority !== null`): caller's priority.
 * - During idle: the instance's own priority (`instance.priority`).
 *
 * If the scheduler is already processing, the instance is queued and will
 * be picked up by the running work loop (same priority = same batch,
 * higher priority = preemption at next check).
 *
 * @param instance - The GenInstance to rerender.
 */
export function scheduleUpdate(instance: GenInstance): void {
  const priority = renderState.renderingPriority ?? instance.priority;

  let set = _pendingUpdates.get(priority);
  if (!set) {
    set = new Set();
    _pendingUpdates.set(priority, set);
  }
  set.add(instance);

  if (!_isProcessing) {
    _isProcessing = true;
    _runLoop();
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
  const prevSync = _syncMode;
  _syncMode = true;

  if (fn) {
    // Suppress immediate processing during fn so all setState calls batch.
    const wasProcessing = _isProcessing;
    _isProcessing = true;
    try {
      fn();
    } finally {
      _isProcessing = wasProcessing;
    }
  }

  if (!_isProcessing && _hasPendingWork()) {
    _isProcessing = true;
    _runLoop();
  }

  _syncMode = prevSync;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Returns true if any priority level has pending instances. */
function _hasPendingWork(): boolean {
  for (const [, set] of _pendingUpdates) {
    if (set.size > 0) return true;
  }
  return false;
}

/**
 * Returns the lowest priority number (= highest urgency) that has pending
 * work, or `null` if all queues are empty.
 */
function _getLowestPriority(): number | null {
  let min: number | null = null;
  for (const [p, set] of _pendingUpdates) {
    if (set.size > 0 && (min === null || p < min)) min = p;
  }
  return min;
}

/**
 * Returns the lowest priority number that is strictly less than `ceiling`
 * and has pending work. Used for preemption detection.
 */
function _getHigherPriorityThan(ceiling: number): number | null {
  let min: number | null = null;
  for (const [p, set] of _pendingUpdates) {
    if (p < ceiling && set.size > 0 && (min === null || p < min)) min = p;
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
function _runLoop(): void {
  let deadline = performance.now() + _timeSlice;

  while (true) {
    let priority: number;

    if (_activePriority !== null) {
      // Resuming a partially-processed priority level (after yield-to-browser).
      priority = _activePriority;
    } else {
      const p = _getLowestPriority();
      if (p === null) {
        _isProcessing = false;
        return;
      }
      priority = p;
      _activePriority = priority;
      beginPatch();
    }

    const set = _pendingUpdates.get(priority)!;

    while (set.size > 0) {
      const instance = set.values().next().value!;
      set.delete(instance);

      instance._executeRerender();

      // Preemption: process any higher-priority work that arrived during rerender.
      _handlePreemption(priority);

      // Time-slicing (async mode only): yield to browser if deadline exceeded.
      if (!_syncMode && set.size > 0 && performance.now() >= deadline) {
        _yieldToBrowser();
        return; // exit — the MessageChannel callback resumes via _runLoop
      }
    }

    // All instances at this priority level processed — commit the batch.
    commitPatch();
    _pendingUpdates.delete(priority);
    _activePriority = null;
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
function _handlePreemption(currentPriority: number): void {
  while (true) {
    const hp = _getHigherPriorityThan(currentPriority);
    if (hp === null) return;

    // Save current priority's partial patch ops.
    const savedOps = savePatchOps();

    // Process the higher-priority level fully.
    const set = _pendingUpdates.get(hp)!;
    beginPatch();

    while (set.size > 0) {
      const inst = set.values().next().value!;
      set.delete(inst);
      inst._executeRerender();

      // Recursive preemption: even higher priority may have arrived.
      _handlePreemption(hp);
    }

    commitPatch();
    _pendingUpdates.delete(hp);

    // Restore current priority's partial patch ops.
    restorePatchOps(savedOps);
  }
}

/**
 * Yield to the browser, then resume the work loop.
 *
 * Uses `MessageChannel` for minimal-latency scheduling (same technique
 * as React's scheduler). Saves and restores global render state around
 * the yield so event handlers during the pause don't corrupt it.
 *
 * `_activePriority` remains set so `_runLoop` knows to resume the
 * partially-processed priority level on callback.
 */
function _yieldToBrowser(): void {
  // Save global state that event handlers might disturb.
  const savedCtxMap = _getCtxMap();
  const savedLiveOnlyMode = renderState.liveOnlyMode;

  if (typeof MessageChannel !== 'undefined') {
    const mc = new MessageChannel();
    mc.port1.onmessage = () => {
      _setCtxMap(savedCtxMap);
      renderState.liveOnlyMode = savedLiveOnlyMode;
      _runLoop();
    };
    mc.port2.postMessage(null);
  } else {
    // Fallback for environments without MessageChannel.
    setTimeout(() => {
      _setCtxMap(savedCtxMap);
      renderState.liveOnlyMode = savedLiveOnlyMode;
      _runLoop();
    }, 0);
  }
}
