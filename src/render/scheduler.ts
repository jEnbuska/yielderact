/**
 * scheduler.ts — Per-root scheduler that owns all rendering state.
 *
 * Each `createRoot()` creates a Scheduler. It manages:
 * - Work queue of generator-based render tasks
 * - DOM operation batching (ops queue)
 * - Event delegation root
 * - Time-sliced cooperative scheduling
 *
 * Stored in the context map via `SchedulerCtx` so generators can
 * access it via `yield* getContextMap()`.
 */

import type { Context } from "../context";
import type { DelegationRoot } from "./delegation";
import { driveWithContext, type RenderGenerator } from "./driver";
import type { ComponentInstance } from "./types";

/** Time budget per work chunk in milliseconds. */
const TIME_SLICE = 5;

/**
 * Context key for the per-root Scheduler.
 *
 * Set by `render()` / `createRoot()` in the initial ctxMap.
 * Read by generator code via `resolveCtx(ctxMap, SchedulerCtx)`.
 */
export const SchedulerCtx: Context<Scheduler> = {
  defaultValue: undefined as never,
};

/**
 * Per-root scheduler and render state.
 *
 * Created by `createRoot()` / `render()`. Manages the work queue,
 * DOM batching, event delegation, and cooperative time-slicing.
 */
export class Scheduler {
  /** True during the initial synchronous mount. */
  isInitialMount = false;

  /** The component currently executing its generator body. */
  renderingInstance?: ComponentInstance;

  /** Queued DOM operations for atomic commit. */
  ops?: (() => void)[];

  /** Event delegation root for this render root. */
  delegationRoot?: DelegationRoot;

  private readonly workQueue: Generator<unknown, void, unknown>[] = [];
  private readonly pendingUpdates = new Set<ComponentInstance>();
  private isProcessing = false;
  private syncMode = true;

  /**
   * Submit a generator as work.
   *
   * The generator is wrapped with `driveWithContext` so context ops are
   * handled transparently. If the scheduler isn't running, it starts.
   */
  submit(gen: RenderGenerator<void>, ctxMap: ReadonlyMap<Context, unknown>): void {
    this.workQueue.push(driveWithContext(ctxMap, gen));
    this.start();
  }

  /**
   * Schedule a rerender for a component instance.
   */
  scheduleUpdate(instance: ComponentInstance): void {
    this.pendingUpdates.add(instance);
    this.start();
  }

  /**
   * Remove an instance from the pending set (e.g. on unmount).
   */
  removePending(instance: ComponentInstance): void {
    this.pendingUpdates.delete(instance);
  }

  /**
   * Run all pending work synchronously, ignoring time slicing.
   */
  flushSync(fn?: () => void): void {
    const { syncMode: prevSync } = this;
    this.syncMode = true;

    if (fn) {
      const { isProcessing: wasProcessing } = this;
      this.isProcessing = true;
      try {
        fn();
      } finally {
        this.isProcessing = wasProcessing;
      }
    }

    if (!this.isProcessing && this.hasPendingWork()) {
      this.isProcessing = true;
      this.runLoop();
    }

    this.syncMode = prevSync;
  }

  /**
   * Flush any pending work. Called by event dispatch after a delegated
   * event has been fully dispatched.
   */
  flush(): void {
    if (!this.hasPendingWork()) return;
    this.isProcessing = true;
    this.runLoop();
  }

  /** Begin collecting DOM operations for atomic commit. */
  beginBatch(): void {
    this.ops = [];
  }

  /** Commit all collected DOM operations synchronously. */
  commitBatch(): void {
    if (!this.ops) return;
    const { ops } = this;
    this.ops = undefined;
    for (let i = 0; i < ops.length; i++) ops[i]?.();
  }

  // ── Private ──────────────────────────────────────────────────────────

  private start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.runLoop();
  }

  private hasPendingWork(): boolean {
    return this.pendingUpdates.size > 0 || this.workQueue.length > 0;
  }

  private drainPendingUpdates(): void {
    if (this.pendingUpdates.size === 0) return;
    const instances = [...this.pendingUpdates];
    this.pendingUpdates.clear();
    for (const instance of instances) {
      instance.executeRerender();
    }
  }

  private runLoop(): void {
    const deadline = performance.now() + TIME_SLICE;

    this.beginBatch();

    while (true) {
      this.drainPendingUpdates();

      if (this.workQueue.length === 0) break;

      const gen = this.workQueue[0] as Generator<unknown, void, unknown>;
      let result = gen.next();

      while (!result.done) {
        if (!this.syncMode && performance.now() >= deadline) {
          this.commitBatch();
          this.yieldToBrowser();
          return;
        }
        result = gen.next();
      }

      this.workQueue.shift();
    }

    this.commitBatch();
    this.isProcessing = false;
  }

  private yieldToBrowser(): void {
    if (typeof MessageChannel !== "undefined") {
      const mc = new MessageChannel();
      mc.port1.onmessage = () => {
        this.runLoop();
      };
      mc.port2.postMessage(null);
    } else {
      setTimeout(() => {
        this.runLoop();
      }, 0);
    }
  }
}
