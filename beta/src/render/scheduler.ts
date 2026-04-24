/**
 * Scheduler — per-root work queues for render, effect, and resolve.
 *
 * Six render/effect queues (primary + deferred for each) plus a single
 * resolve queue. Render scheduling routes by `instance.deferred()` (the
 * live Deferred-context value), so the same instance can land in primary
 * or deferred depending on when it gets scheduled.
 *
 * Drain order per outer-loop iteration: primary renders → primary effects
 * → deferred renders. The outer loop runs until both render queues are
 * empty. Deferred renders may be time-sliced and bail when primary work
 * arrives; the bailed work is re-scheduled and resumed in a later
 * iteration.
 */
import { BaseInstance } from "../instances/base-instance";
import { createResolvable } from "../create-resolvable";

/** Apply pending DOM ops parent-first, then commit leaf-first. */
function flush(instances: BaseInstance[]) {
  for (const instance of instances) instance.updateDOM();
  for (let i = instances.length - 1; i >= 0; i--) {
    instances[i]!.commit();
  }
}

/**
 * Insert `instance` into a depth-ordered queue: deepest at index 0,
 * shallowest at the tail so `pop()` yields the topmost ancestor first.
 * No-ops if `instance` is already a member; tail fast-path covers the
 * common "incoming is at or shallower than current shallowest" case.
 */
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

  /**
   * Staging area for deferred instances whose `apply()` finished but
   * whose `updateDOM`/`commit` hasn't run yet. Persists across drain
   * bails — the members set provides cross-bail dedup so accumulated
   * work isn't lost when deferred is interrupted by primary work.
   */
  private deferredResolvedQueue: BaseInstance[] = [];
  private deferredResolvedMembers = new Set<BaseInstance>();

  private batchDepth = 0;

  private resolvable = createResolvable();

  constructor() {
    this.resolvable.promise.then(this.run);
  }

  scheduleRender(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) {
      insertSorted(this.renderDeferredQueue, this.renderDeferredMembers, instance);
    } else {
      insertSorted(this.renderPrimaryQueue, this.renderPrimaryMembers, instance);
    }
    this.resolvable.resolve();
  }

  unscheduleRender(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) this.renderDeferredMembers.delete(instance);
    else this.renderPrimaryMembers.delete(instance);
  }

  scheduleEffect(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) {
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
   * Yield to the browser via MessageChannel + requestIdleCallback so
   * input events and paint can run between deferred work slices.
   */
  private async scheduleYield(): Promise<void> {
    const { promise, resolve } = createResolvable<unknown>();
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = resolve;
    port2.postMessage(null);
    await promise;
  }

  private run = async (): Promise<void> => {
    await this.resolvable.promise;
    while (this.renderPrimaryQueue.length || this.renderDeferredQueue.length) {
      this.runPrimaryQueue();

      for (const next of this.effectPrimaryQueue) next.runEffects();
      this.effectPrimaryQueue.length = 0;
      this.effectPrimaryMembers.clear();

      await this.runDeferredQueue();
    }
    // Drain anything left in `deferredResolvedQueue`. `runDeferredQueue`
    // returns without flushing on bail (primary work arrived or
    // `instance.deferred()` flipped), so accumulated `pendingDomUpdates`
    // / `commit`s would otherwise be stranded if the deferred queue
    // empties via re-routing rather than its natural while-loop exit.

    flush(this.deferredResolvedQueue);
    this.deferredResolvedQueue.length = 0;
    this.deferredResolvedMembers.clear();

    for (const next of this.effectDeferredQueue) next.runEffects();
    this.effectDeferredQueue.length = 0;
    this.effectDeferredMembers.clear();

    for (const next of this.resolveQueue) next.resolveStatePromises();
    this.resolveQueue.length = 0;
    this.resolveMembers.clear();

    // Only recreate the resolvable when *all* queues are empty. If a
    // `scheduleRender`/`scheduleEffect`/`scheduleResolve` fired during
    // post-processing it called `resolve()` on the (already-settled) old
    // resolvable — a no-op. Re-attaching `.then(this.run)` to that same
    // resolved promise fires `run` again on the next microtask, draining
    // the gap-added work. Recreate only when there's nothing pending so we
    // genuinely wait for the next external schedule.
    if (
      !this.renderPrimaryQueue.length &&
      !this.renderDeferredQueue.length &&
      !this.effectPrimaryQueue.length &&
      !this.effectDeferredQueue.length &&
      !this.resolveQueue.length
    ) {
      this.resolvable = createResolvable();
    }
    this.resolvable.promise.then(this.run);
  };

  private runPrimaryQueue() {
    const applied: BaseInstance[] = [];
    while (this.renderPrimaryQueue.length) {
      const instance = this.renderPrimaryQueue.pop()!;
      if (!this.renderPrimaryMembers.delete(instance)) continue;
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
        // Re-route: instance was queued as deferred but `instance.deferred()`
        // flipped (e.g., its <Deferred> ancestor committed and reset the
        // handle). Send it to wherever it belongs now.
        this.scheduleRender(instance);
        return;
      }
      const gen = instance.apply();
      let res = gen.next();

      while (!res.done) {
        if (this.renderPrimaryQueue.length) {
          // Primary work appeared mid-render — preserve our progress and
          // bail so primary can run.
          this.scheduleRender(instance);
          return;
        }
        await this.scheduleYield();
        BaseInstance.sliceDeadline = Date.now() + SLICE_MS;
        res = gen.next();
      }
      // Push order is shallowest-first (we pop the tail), so `flush` gets
      // parent-first updateDOM + leaf-first commit — same shape as
      // `runPrimaryQueue`'s `applied`. Dedup via `deferredResolvedMembers`
      // because an earlier bail may have left this instance in the queue
      // from a prior drain.
      if (this.deferredResolvedMembers.has(instance)) continue;
      this.deferredResolvedMembers.add(instance);
      this.deferredResolvedQueue.push(instance);
    }
    flush(this.deferredResolvedQueue);
    this.deferredResolvedQueue.length = 0;
    this.deferredResolvedMembers.clear();
  }
}
