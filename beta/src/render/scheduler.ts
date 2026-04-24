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
import { BaseInstance } from "../instances/base-instance";
import { createResolvable } from "../create-resolvable";

function flush(instances: BaseInstance[]) {
  for (const instance of instances) instance.updateDOM();
  for (let i = instances.length - 1; i >= 0; i--) {
    instances[i]!.commit();
  }
}

function insertSorted(
  queue: BaseInstance[],
  members: Set<BaseInstance>,
  instance: BaseInstance,
): void {
  if (members.has(instance)) return;
  members.add(instance);

  if (!queue.length || queue[queue.length - 1]!.depth >= instance.depth) {
    queue.push(instance);
    return;
  }
  let lo = 0;
  let hi = queue.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const existing = queue[mid]!;
    // Same depth → cluster together (siblings or cousins render order is
    // irrelevant; only parent-before-child matters).
    if (existing.depth === instance.depth) {
      queue.splice(mid, 0, instance);
      return;
    }
    // Deeper instances go earlier in the queue; shallowest end up at the
    // tail so `queue.pop()` yields the topmost ancestor first, giving the
    // render drain parent-before-child order.
    if (instance.depth > existing.depth) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  queue.splice(lo, 0, instance);
}

/** Time budget per deferred work slice (ms), matching React 19. */
const SLICE_MS = 10;

export class Scheduler {
  private renderPrimaryQueue: BaseInstance[] = [];
  private renderPrimaryMembers = new Set<BaseInstance>();

  private renderDeferredQueue: BaseInstance[] = [];
  private renderDeferredMembers = new Set<BaseInstance>();

  private effectPrimaryQueue: BaseInstance[] = [];
  private effectPrimaryMembers = new Set<BaseInstance>();

  private effectDeferredQueue: BaseInstance[] = [];
  private effectDeferredMembers = new Set<BaseInstance>();

  private resolveQueue: BaseInstance[] = [];
  private resolveMembers = new Set<BaseInstance>();

  private deferredResolvedQueue: BaseInstance[] = [];
  private deferredResolvedMembers = new Set<BaseInstance>();
  /** In-progress render generators for deferred instances interrupted by time-slicing. */
  private batchDepth = 0;
  searches = 0;

  private resolvable = createResolvable();

  constructor() {
    this.resolvable.promise.then(this.run);
  }

  scheduleTime = 0;

  scheduleRender(instance: BaseInstance, deferred?: boolean): void {
    if (deferred === false || !instance.deferred()) {
      insertSorted(this.renderPrimaryQueue, this.renderPrimaryMembers, instance);
    } else {
      insertSorted(this.renderDeferredQueue, this.renderDeferredMembers, instance);
    }
    this.resolvable.resolve();
  }

  unscheduleRender(instance: BaseInstance, deferred?: boolean): void {
    if (deferred || instance.deferred()) this.renderDeferredMembers.delete(instance);
    else this.renderPrimaryMembers.delete(instance);
  }

  scheduleEffect(instance: BaseInstance, deferred?: boolean): void {
    if (deferred || instance.deferred()) {
      insertSorted(this.effectDeferredQueue, this.effectDeferredMembers, instance);
    } else {
      insertSorted(this.effectPrimaryQueue, this.effectPrimaryMembers, instance);
    }
    this.resolvable.resolve();
  }

  scheduleResolve(instance: BaseInstance): void {
    insertSorted(this.resolveQueue, this.resolveMembers, instance);
    this.resolvable.resolve();
  }

  unscheduleResolve(instance: BaseInstance): void {
    this.resolveMembers.delete(instance);
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
  private scheduleYield(): Promise<unknown> {
    const { promise, resolve } = createResolvable<unknown>();
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => requestIdleCallback(resolve);

    port2.postMessage(null);
    return promise;
  }

  private run = async (): Promise<void> => {
    await this.resolvable.promise;
    this.scheduleTime = 0;
    while (this.renderPrimaryQueue.length || this.renderDeferredQueue.length) {
      this.runPrimaryQueue();

      for (const next of this.effectPrimaryQueue) next.runEffects();
      this.effectPrimaryQueue.length = 0;
      this.effectPrimaryMembers.clear();

      await this.runDeferredQueue();
    }
    for (const next of this.effectDeferredQueue) next.runEffects();
    this.effectDeferredQueue.length = 0;
    this.effectDeferredMembers.clear();

    for (const next of this.resolveQueue) next.resolveStatePromises();
    this.resolveQueue.length = 0;
    this.resolveMembers.clear();

    console.log(this.searches, "THIS SCHEDULE TIME", this.scheduleTime);
    this.resolvable = createResolvable();
    this.resolvable.promise.then(this.run);
  };

  private runPrimaryQueue() {
    const applied: BaseInstance[] = [];

    while (this.renderPrimaryQueue.length) {
      const instance = this.renderPrimaryQueue.pop()!;
      if (!this.renderPrimaryMembers.delete(instance)) continue;
      if (instance.deferred()) {
        this.scheduleRender(instance);
        continue;
      }
      const gen = instance.apply();
      let res = gen.next();
      while (!res.done) res = gen.next();
      applied.push(instance);
    }
    flush(applied);
  }

  private async runDeferredQueue() {
    BaseInstance.sliceDeadline = Date.now() + SLICE_MS;
    while (this.renderDeferredQueue.length) {
      const instance = this.renderDeferredQueue.pop()!;
      if (!this.renderDeferredMembers.delete(instance)) continue;
      if (!instance.deferred()) {
        this.scheduleRender(instance);
        return;
      }
      const gen = instance.apply();
      let res = gen.next();

      while (!res.done) {
        if (this.renderPrimaryQueue.length) {
          this.scheduleRender(instance);
          return;
        }
        await this.scheduleYield();
        BaseInstance.sliceDeadline = Date.now() + SLICE_MS;
        res = gen.next();
      }
      // Preserve pop order (shallowest-first) so `flush` gets parent-first
      // updateDOM + leaf-first commit, same shape as `runPrimaryQueue`'s
      // `applied` array. Dedup via `deferredResolvedMembers` because an
      // earlier bail may have left this instance in the queue from a prior
      // drain.
      if (this.deferredResolvedMembers.has(instance)) continue;
      this.deferredResolvedMembers.add(instance);
      this.deferredResolvedQueue.push(instance);
    }
    flush(this.deferredResolvedQueue);
    this.deferredResolvedQueue.length = 0;
    this.deferredResolvedMembers.clear();
  }
}
