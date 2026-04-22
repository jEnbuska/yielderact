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
import { BaseInstance, perf } from "../instances/base-instance";
import { createResolvable } from "../create-resolvable";

function comparePaths(a: readonly number[], b: readonly number[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    if (av !== bv) return av - bv;
  }
  return a.length - b.length;
}

/** Time budget per deferred work slice (ms), matching React 19. */
const SLICE_MS = 10;

export class Scheduler {
  private running?: BaseInstance;
  private primaryQueue: BaseInstance[] = [];
  private primaryMembers = new Set<BaseInstance>();

  private deferredQueue: BaseInstance[] = [];
  private deferredMembers = new Set<BaseInstance>();
  /** In-progress render generators for deferred instances interrupted by time-slicing. */
  private batchDepth = 0;
  searches = 0;

  private resolvable = createResolvable();

  constructor() {
    this.resolvable.promise.then(() => this.run());
  }

  scheduleTime = 0;

  schedule(instance: BaseInstance): void {
    const start = performance.now();
    this.insertByPath(instance);
    this.resolvable.resolve();
    this.scheduleTime += performance.now() - start;
  }

  unschedule(instance: BaseInstance): void {
    this.primaryMembers.delete(instance);
    this.deferredMembers.delete(instance);
  }

  /** Insert `instance` into `queue` in path order, skipping duplicates. */
  insertByPath(instance: BaseInstance): void {
    const group = instance.isDeferred() ? "deferred" : "primary";
    const members = this[`${group}Members`];
    const queue = this[`${group}Queue`];
    if (members.has(instance)) return;
    members.add(instance);
    if (this.running === instance.parent) {
      queue.push(instance);
      return;
    }
    let lo = 0;
    let hi = queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const existing = queue[mid]!;
      if (existing.parent === instance.parent) {
        queue.splice(mid, 0, instance);
        return;
      }
      if (comparePaths(instance.path, existing.path) > 0) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    queue.splice(lo, 0, instance);
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
      requestIdleCallback(() => resolve(Date.now()));
    };
    port2.postMessage(null);
    return promise;
  }

  private async run(): Promise<void> {
    while (true) {
      console.log("run");
      await this.resolvable.promise;
      this.scheduleTime = 0;
      while (this.primaryQueue.length || this.deferredQueue.length) {
        this.runPrimaryQueue();
        await this.runDeferredQueue();
      }
      console.log(this.searches, "THIS SCHEDULE TIME", this.scheduleTime);

      this.resolvable = createResolvable();
    }
  }

  private runPrimaryQueue() {
    const applied: BaseInstance[] = [];
    while (this.primaryQueue.length) {
      const instance = this.primaryQueue.pop()!;
      if (!this.primaryMembers.delete(instance)) continue;
      if (instance.isDeferred()) {
        this.running = undefined;
        this.insertByPath(instance);
        continue;
      }
      this.running = instance;
      const gen = instance.apply();
      let res = gen.next();
      while (!res.done) res = gen.next();
      instance.commitApply(res.value);
      applied.push(instance);
    }
    this.running = undefined;
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
    perf.reset();
    const queueStart = Date.now();
    BaseInstance.sliceDeadline = Date.now() + SLICE_MS;
    while (this.deferredQueue.length) {
      const instance = this.deferredQueue.pop()!;
      if (!this.deferredMembers.delete(instance)) continue;
      if (!instance.isDeferred()) {
        this.running = undefined;
        this.insertByPath(instance);
        return;
      }
      this.running = instance;
      const gen = instance.apply();
      let res = gen.next();

      while (!res.done) {
        if (this.primaryQueue.length) {
          this.running = undefined;
          this.insertByPath(instance);
          return;
        }
        await this.scheduleYield();
        BaseInstance.sliceDeadline = Date.now() + SLICE_MS;
        res = gen.next();
      }
      instance.commitApply(res.value);
      this.deferredApplied.push(instance);
    }
    this.running = undefined;
    console.log(
      `[deferred] reconciled ${this.deferredApplied.length} instances in ${Date.now() - queueStart}ms`,
    );
    perf.dump();

    let stepStart = Date.now();
    for (const instance of this.deferredApplied) {
      instance.applyDomUpdates();
    }
    console.log(`[deferred] DOM applied in ${Date.now() - stepStart}ms`);

    stepStart = Date.now();
    for (let i = this.deferredApplied.length - 1; i >= 0; i--) {
      this.deferredApplied[i]!.afterAllApplied();
    }
    console.log(`[deferred] hooks applied in ${Date.now() - stepStart}ms`);
    console.log(`[deferred] total: ${Date.now() - queueStart}ms`);
    this.deferredApplied = [];
  }
}
