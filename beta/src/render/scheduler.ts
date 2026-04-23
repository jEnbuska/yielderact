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
import type { ScheduleGroup } from "./types";

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

  private deferredResolved: BaseInstance[] = [];
  /** In-progress render generators for deferred instances interrupted by time-slicing. */
  private batchDepth = 0;
  searches = 0;

  private resolvable = createResolvable();

  constructor() {
    this.resolvable.promise.then(this.run);
  }

  scheduleTime = 0;

  schedule(instance: BaseInstance, group: ScheduleGroup): void {
    this.insertByPath(instance, group);
    this.resolvable.resolve();
  }

  unschedule(instance: BaseInstance, group: ScheduleGroup): void {
    switch (group) {
      case "render":
        if (instance.isDeferred()) this.renderDeferredMembers.delete(instance);
        else this.renderPrimaryMembers.delete(instance);
        return;
      case "effect": {
        if (instance.isDeferred()) this.effectDeferredMembers.delete(instance);
        else this.effectPrimaryMembers.delete(instance);
        return;
      }
      case "resolve": {
        this.resolveMembers.delete(instance);
        return;
      }
    }
  }

  /** Insert `instance` into `queue` in path order, skipping duplicates. */
  insertByPath(instance: BaseInstance, group: ScheduleGroup): void {
    let members: Set<BaseInstance>;
    let queue: BaseInstance[];
    switch (group) {
      case "render": {
        if (instance.isDeferred()) {
          members = this.renderDeferredMembers;
          queue = this.renderDeferredQueue;
        } else {
          members = this.renderPrimaryMembers;
          queue = this.renderPrimaryQueue;
        }
        break;
      }
      case "effect": {
        if (instance.isDeferred()) {
          members = this.effectDeferredMembers;
          queue = this.effectDeferredQueue;
        } else {
          members = this.effectPrimaryMembers;
          queue = this.effectPrimaryQueue;
        }
        break;
      }
      case "resolve": {
        members = this.resolveMembers;
        queue = this.resolveQueue;
        break;
      }
    }

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
    port1.onmessage = () => requestIdleCallback(() => resolve(Date.now()));

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
      if (instance.isDeferred()) {
        this.running = undefined;
        this.insertByPath(instance, "render");
        continue;
      }
      this.running = instance;
      const gen = instance.apply();
      let res = gen.next();
      while (!res.done) res = gen.next();
      applied.push(instance);
    }
    this.running = undefined;
    // Commit DOM updates parent-first (rendered is leaf-first via unshift).
    for (const instance of applied) instance.updateDOM();
    // Then run hooks leaf-first.
    for (let i = applied.length - 1; i >= 0; i--) applied[i]!.commit();
  }

  private async runDeferredQueue() {
    BaseInstance.sliceDeadline = Date.now() + SLICE_MS;
    while (this.renderDeferredQueue.length) {
      const instance = this.renderDeferredQueue.pop()!;
      if (!this.renderDeferredMembers.delete(instance)) continue;
      if (!instance.isDeferred()) {
        this.running = undefined;
        this.insertByPath(instance, "render");
        return;
      }
      this.running = instance;
      const gen = instance.apply();
      let res = gen.next();

      while (!res.done) {
        if (this.renderPrimaryQueue.length) {
          this.running = undefined;
          this.insertByPath(instance, "render");
          return;
        }
        await this.scheduleYield();
        BaseInstance.sliceDeadline = Date.now() + SLICE_MS;
        res = gen.next();
      }
      this.deferredResolved.push(instance);
    }
    this.running = undefined;
    for (const instance of this.deferredResolved) instance.updateDOM();
    for (let i = this.deferredResolved.length - 1; i >= 0; i--) this.deferredResolved[i]!.commit();

    this.deferredResolved.length = 0;
  }
}
