/**
 * scheduler.ts — Interruptible work loop for rendering.
 *
 * Work is represented as generators that `yield` at natural boundaries
 * (between children in reconcileSlots, between component mounts). A single
 * work loop advances the generator, checking a time deadline after each
 * step. When the deadline is exceeded, the loop yields to the browser via
 * `MessageChannel`, allowing pending events (clicks, input, etc.) to fire.
 * On resume, the loop checks for interruptions (state changes from events)
 * before continuing.
 *
 * **Sync mode** (default): The work loop runs to completion without
 * yielding, preserving the current synchronous rendering behavior.
 * Essential for tests and simple applications.
 *
 * **Async mode**: The work loop yields to the browser every ~5ms,
 * keeping the UI responsive during large renders.
 */

import { _getCtxMap, _setCtxMap } from '../context';
import { renderState } from './state';
import type { GenInstance } from './types';

/** A generator that yields `void` at yield points and returns `void` when done. */
export type WorkGenerator = Generator<void, void, void>;

// ── Scheduler state ──────────────────────────────────────────────────────────

/** The generator currently being processed, or null if idle. */
let _currentGen: WorkGenerator | null = null;

/** The instance being rendered by the current generator (for interruption detection). */
let _currentInstance: GenInstance | null = null;

/** Resolver for the promise returned by the current `schedule()` call. */
let _currentResolve: (() => void) | null = null;

/** Factory to recreate the work generator on interruption (restart). */
let _currentFactory: (() => WorkGenerator) | null = null;

/** Queued work items waiting to be processed. */
const _queue: Array<{
  factory: () => WorkGenerator;
  instance: GenInstance;
  resolve: () => void;
}> = [];

/** True while the work loop is actively executing. */
let _isProcessing = false;

/** When true, the work loop never yields to the browser. */
let _syncMode = true;

/** Time budget per work chunk in milliseconds. */
let _timeSlice = 5;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule a render work generator for execution.
 *
 * If the scheduler is idle, processing starts immediately. If work is
 * already in progress, the new work is queued and processed after the
 * current work completes.
 *
 * @param factory  - Factory function that creates the work generator.
 *                   Called again on interruption (restart).
 * @param instance - The GenInstance being rendered (for interruption detection).
 * @returns A Promise that resolves when the work completes.
 */
export function schedule(factory: () => WorkGenerator, instance: GenInstance): Promise<void> {
  return new Promise<void>((resolve) => {
    if (_currentGen) {
      // Work already in progress — queue this for later.
      _queue.push({ factory, instance, resolve });
    } else {
      _currentFactory = factory;
      _currentGen = factory();
      _currentInstance = instance;
      _currentResolve = resolve;
      if (!_isProcessing) {
        _runWorkLoop();
      }
    }
  });
}

/**
 * Run all pending work synchronously, ignoring time slicing.
 *
 * Essential for tests and for event handlers that need immediate DOM
 * updates. Optionally accepts a function to execute before flushing
 * (e.g., a state change that triggers a rerender).
 */
export function flushSync(fn?: () => void): void {
  fn?.();
  const prevSync = _syncMode;
  _syncMode = true;
  if (_currentGen && !_isProcessing) {
    _runWorkLoop();
  }
  _syncMode = prevSync;
}

/** Returns true while the scheduler is actively processing work. */
export function schedulerIsProcessing(): boolean {
  return _isProcessing;
}

/** Enable or disable sync mode (no yielding). */
export function setSchedulerSync(sync: boolean): void {
  _syncMode = sync;
}

/** Get current sync mode. */
export function getSchedulerSync(): boolean {
  return _syncMode;
}

/** Set the time slice budget (ms). */
export function setTimeSlice(ms: number): void {
  _timeSlice = ms;
}

// ── Work loop ────────────────────────────────────────────────────────────────

/**
 * The main work loop. Advances the current generator and checks the
 * time deadline after each step. In sync mode, runs to completion.
 */
function _runWorkLoop(): void {
  _isProcessing = true;
  const deadline = performance.now() + _timeSlice;

  while (_currentGen) {
    // ── Check for interruption (pendingRerender from an event during yield) ──
    if (_currentInstance?.pendingRerender) {
      _currentInstance.pendingRerender = false;
      // Restart: discard old generator, create a fresh one with latest state.
      _currentGen = _currentFactory!();
    }

    const { done } = _currentGen.next();

    if (done) {
      const resolve = _currentResolve;
      _currentGen = null;
      _currentInstance = null;
      _currentResolve = null;
      _currentFactory = null;
      resolve?.();

      // Pick up next queued work.
      if (_queue.length > 0) {
        const next = _queue.shift()!;
        _currentFactory = next.factory;
        _currentGen = next.factory();
        _currentInstance = next.instance;
        _currentResolve = next.resolve;
        continue;
      }
      break;
    }

    // ── Deadline check (async mode only) ──
    if (!_syncMode && performance.now() >= deadline) {
      _yieldToBrowser();
      return; // exit — the MessageChannel callback will resume
    }
  }

  _isProcessing = false;
}

/**
 * Yield to the browser, then resume the work loop.
 *
 * Uses `MessageChannel` for minimal-latency scheduling (same technique
 * as React's scheduler). Saves and restores global render state around
 * the yield so event handlers during the pause don't corrupt it.
 */
function _yieldToBrowser(): void {
  // Save global state that event handlers might disturb.
  const savedCtxMap = _getCtxMap();
  const savedLiveOnlyMode = renderState.liveOnlyMode;

  _isProcessing = false; // allow event-driven setState to call rerender()

  if (typeof MessageChannel !== 'undefined') {
    const mc = new MessageChannel();
    mc.port1.onmessage = () => {
      _setCtxMap(savedCtxMap);
      renderState.liveOnlyMode = savedLiveOnlyMode;
      _runWorkLoop();
    };
    mc.port2.postMessage(null);
  } else {
    // Fallback for environments without MessageChannel.
    setTimeout(() => {
      _setCtxMap(savedCtxMap);
      renderState.liveOnlyMode = savedLiveOnlyMode;
      _runWorkLoop();
    }, 0);
  }
}
