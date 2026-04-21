/**
 * Scheduler — minimal per-root work queue with batching.
 *
 * The scheduler owns only a path-ordered render queue and a batch depth
 * counter. Everything else (render pipeline, DOM writes, effect dispatch)
 * lives on the instances themselves. When `flush()` drains the queue it
 * simply calls `instance.render()` (which internally clears its render
 * reasons) and then `instance.afterRender()` on whichever instances ran.
 *
 * `schedule` / `unschedule` are the two entry points instances use; the
 * instance decides WHEN to call them via `scheduleApply(reason)` and
 * `unscheduleApply(reason)`, and whether the instance ends up in the
 * queue at all depends on its reason set (see BaseInstance).
 */
import type { BaseInstance } from "../instances/base-instance";
import { createResolvable } from "../create-resolvable";
import { invokeUpdates } from "../reconciler/invoke-updates";

function comparePaths(a: readonly number[], b: readonly number[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return a.length - b.length;
}

/** Insert `instance` into `queue` in path order, skipping duplicates. */
function insertByPath(queue: BaseInstance[], instance: BaseInstance): void {
  if (queue.includes(instance)) return;
  let lo = 0;
  let hi = queue.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const existing = queue[mid];
    if (!existing || comparePaths(instance.path, existing.path) < 0) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  queue.splice(lo, 0, instance);
}

/** Time budget per deferred work slice (ms), matching React 19. */
const SLICE_MS = 5;

export class Scheduler {
  private queue: BaseInstance[] = [];
  private deferredQueue: BaseInstance[] = [];
  /** In-progress render generators for deferred instances interrupted by time-slicing. */
  private batchDepth = 0;

  private resolvable = createResolvable();

  constructor() {
    this.resolvable.promise.then(() => this.run());
  }

  schedule(instance: BaseInstance): void {
    const queue = instance.isDeferred() ? this.deferredQueue : this.queue;
    insertByPath(queue, instance);
    this.resolvable.resolve();
  }

  unschedule(instance: BaseInstance): void {
    let i = this.queue.indexOf(instance);
    if (i >= 0) this.queue.splice(i, 1);
    i = this.deferredQueue.indexOf(instance);
    if (i >= 0) this.deferredQueue.splice(i, 1);
  }

  beginBatch(): void {
    this.batchDepth++;
  }

  endBatch(): void {
    this.batchDepth--;
    if (this.batchDepth === 0) void this.resolvable.resolve();
  }

  /**
   * Yield to the browser via MessageChannel so input events and
   * paint can run between deferred work slices.
   */
  private scheduleYield(): Promise<number> {
    const { promise, resolve } = createResolvable<number>();
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => {
      resolve(Date.now());
    };
    port2.postMessage(null);
    return promise;
  }

  private async run(): Promise<void> {
    while (true) {
      await this.resolvable.promise;
      while (this.queue.length || this.deferredQueue.length) {
        this.runPrimaryQueue();
        await this.runDeferredQueue();
      }
      this.resolvable = createResolvable();
    }
  }

  private runPrimaryQueue() {
    const applied: BaseInstance[] = [];
    while (this.queue.length) {
      const instance = this.queue.shift()!;
      if (instance.isDeferred()) {
        insertByPath(this.deferredQueue, instance);
        continue;
      }
      const gen = invokeUpdates(instance, instance.apply());
      let res = gen.next();
      while (!res.done) res = gen.next();

      instance.commitApply(res.value);
      applied.push(instance);
    }
    // Commit DOM updates parent-first (rendered is leaf-first via unshift).
    for (const instance of applied) {
      instance.applyDomUpdates();
    }

    // Then run hooks leaf-first.
    for (let i = applied.length - 1; i >= 0; i--) {
      applied[i]!.afterAllApplied();
    }
  }

  private deferredApplied: BaseInstance[] = [];
  private async runDeferredQueue() {
    let start = Date.now();
    while (this.deferredQueue.length) {
      const instance = this.deferredQueue.shift()!;
      if (!instance.isDeferred()) {
        insertByPath(this.queue, instance);
        return;
      }

      const gen = invokeUpdates(instance, instance.apply());
      let res = gen.next();

      while (!res.done) {
        if (start + 50 < Date.now()) {
          await this.scheduleYield();
          start = Date.now();
        }
        if (this.queue.length) {
          insertByPath(this.deferredQueue, instance);
          return;
        }
        res = gen.next();
      }
      instance.commitApply(res.value);
      insertByPath(this.deferredApplied, instance);
    }
    // Commit DOM updates parent-first (rendered is leaf-first via unshift).
    for (const instance of this.deferredApplied) {
      instance.applyDomUpdates();
    }

    // Then run hooks leaf-first.
    for (let i = this.deferredApplied.length - 1; i >= 0; i--) {
      this.deferredApplied[i]!.afterAllApplied();
    }
    this.deferredApplied = [];
  }
}
