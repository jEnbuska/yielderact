/**
 * scheduler.ts — Per-root scheduler that owns all rendering state.
 *
 * Each `createRoot()` creates a Scheduler. It manages:
 * - Work queue of generator-based render tasks
 * - DOM operation batching (ops queue)
 * - Event delegation root
 * - Time-sliced cooperative scheduling
 *
 * Work submission (submit/scheduleUpdate) never synchronously enters
 * the run loop. Instead it resolves a pending promise, and the run
 * loop picks up work on the next microtask. This ensures multiple
 * setState calls in the same synchronous block are batched naturally.
 *
 * `flushSync` and `flush` bypass this and run work immediately.
 */

import type { Context } from "../context";
import type { DelegationRoot } from "./delegation";
import { driveWithContext, type RenderGenerator } from "./driver";
import { createResolvable } from "./promise";
import { TreeSet } from "./tree-set";
import type { ComponentInstance } from "./types";

/** A unit of work in the scheduler's queue. */
interface WorkItem {
  instance: ComponentInstance;
  gen: RenderGenerator<void>;
  /** Set when the generator has been wrapped and partially driven. */
  wrapped?: Generator<unknown, void, unknown>;
}

/**
 * Compare two work items by slotId for depth-first tree ordering.
 *
 * Compares element-by-element. Shorter paths that are prefixes sort
 * before longer ones (parent before child). At the same depth, lower
 * index sorts first (left-to-right).
 */
function compareBySlotId(a: WorkItem, b: WorkItem): number {
  const aId = a.instance.slotId;
  const bId = b.instance.slotId;
  const minLen = Math.min(aId.length, bId.length);
  for (let i = 0; i < minLen; i++) {
    const diff = (aId[i] as number) - (bId[i] as number);
    if (diff !== 0) return diff;
  }
  return aId.length - bId.length;
}

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
 * Context key for the parent component's slotId.
 *
 * Set by each component after mount via `setContext`. Child components
 * read this to compute their own `slotId = [...parentSlotId, index]`.
 */
export const ParentSlotIdCtx: Context<number[]> = {
  defaultValue: [],
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

  private readonly workQueue = new TreeSet<WorkItem>(compareBySlotId);
  private readonly pendingUpdates = new Set<ComponentInstance>();
  private readonly scheduledInstances = new Set<ComponentInstance>();
  private isProcessing = false;
  private syncMode = true;
  private trigger = createResolvable();

  constructor() {
    void this.startLoop();
  }

  /**
   * Submit a generator as work.
   *
   * The generator is NOT wrapped yet — wrapping with `driveWithContext`
   * happens at execution time using the instance's current `capturedCtx`,
   * ensuring context changes from parent rerenders are picked up.
   */
  submit(instance: ComponentInstance, gen: RenderGenerator<void>): void {
    this.scheduledInstances.add(instance);
    this.workQueue.add({ instance, gen });
    this.notify();
  }

  /**
   * Schedule a rerender for a component instance.
   *
   * Does not synchronously enter the run loop — resolves the trigger
   * promise so the loop picks it up on the next microtask.
   */
  scheduleUpdate(instance: ComponentInstance): void {
    if (this.scheduledInstances.has(instance)) return;
    this.pendingUpdates.add(instance);
    this.notify();
  }

  /**
   * Remove all pending work for an instance — from both pendingUpdates
   * and the work queue. Called on unmount and when a parent's
   * reconciliation makes a child's queued work redundant.
   */
  removePending(instance: ComponentInstance): void {
    this.pendingUpdates.delete(instance);
    this.scheduledInstances.delete(instance);
    this.workQueue.removeWhere((item) => item.instance === instance);
  }

  /**
   * Run all pending work synchronously, ignoring time slicing.
   * Bypasses the microtask trigger — runs immediately.
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
      this.processWork();
    }

    this.syncMode = prevSync;
  }

  /**
   * Flush any pending work synchronously. Called by event dispatch
   * after a delegated event has been fully dispatched.
   * Bypasses the microtask trigger — runs immediately.
   */
  flush(): void {
    if (!this.hasPendingWork()) return;
    this.processWork();
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

  /** Resolve the trigger so the async loop wakes up on the next microtask. */
  private notify(): void {
    this.trigger.resolve();
  }

  private hasPendingWork(): boolean {
    return this.pendingUpdates.size > 0 || !this.workQueue.isEmpty();
  }

  private drainPendingUpdates(): void {
    if (this.pendingUpdates.size === 0) return;
    const instances = [...this.pendingUpdates];
    this.pendingUpdates.clear();
    for (const instance of instances) {
      instance.executeRerender();
    }
  }

  /**
   * The persistent async loop. Awaits the trigger promise, processes
   * all pending work, then resets the trigger and waits again.
   */
  private async startLoop(): Promise<void> {
    while (true) {
      await this.trigger.promise;

      // Reset trigger for the next batch before processing,
      // so new work submitted during processing is captured.
      this.trigger = createResolvable();

      if (!this.isProcessing) {
        this.processWork();
      }
    }
  }

  /**
   * Process all pending work synchronously. Called by the async loop,
   * flushSync, and flush.
   */
  private processWork(): void {
    this.isProcessing = true;
    const deadline = performance.now() + TIME_SLICE;

    this.beginBatch();

    while (true) {
      this.drainPendingUpdates();
      if (this.workQueue.isEmpty()) break;

      const work = this.workQueue.next() as WorkItem;
      // Wrap with driveWithContext at execution time (not submission time)
      // so the generator uses the instance's current capturedCtx,
      // picking up any context changes from parent rerenders.
      const wrapped = work.wrapped ?? driveWithContext(work.instance.capturedCtx, work.gen);
      let result = wrapped.next();

      while (!result.done) {
        if (!this.syncMode && performance.now() >= deadline) {
          // Re-add partially-processed work item for later resumption
          this.workQueue.add({ ...work, wrapped });
          this.commitBatch();
          this.yieldToBrowser();
          return;
        }
        result = wrapped.next();
      }
    }

    this.commitBatch();
    this.scheduledInstances.clear();
    this.isProcessing = false;
  }

  private yieldToBrowser(): void {
    if (typeof MessageChannel !== "undefined") {
      const mc = new MessageChannel();
      mc.port1.onmessage = () => {
        this.processWork();
      };
      mc.port2.postMessage(null);
    } else {
      setTimeout(() => {
        this.processWork();
      }, 0);
    }
  }
}
