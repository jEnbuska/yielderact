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
 * empty. Defer renders may be time-sliced and bail when primary work
 * arrives; the bailed work is re-scheduled and resumed in a later
 * iteration.
 */
import { BaseInstance } from "../instances/base-instance";
import { createResolvable } from "../create-resolvable";

/** Apply pending DOM ops parent-first */
function updateDOM(groups: QueueGroup[], members: Set<BaseInstance>) {
  for (let i = groups.length - 1; i >= 0; i--) {
    const { instances } = groups[i]!;
    for (const instance of instances) {
      if (members.has(instance)) instance.updateDOM();
    }
  }
  members.clear();
  groups.length = 0;
}

function runEffects(group: QueueGroup[], members: Set<BaseInstance>) {
  for (let i = 0; i < group.length; i++) {
    const { instances } = group[i]!;
    for (const instance of instances) {
      if (members.has(instance)) instance.runEffects();
    }
  }
  group.length = 0;
  members.clear();
}

function unmountUnmounted(instances: Set<BaseInstance>) {
  for (const instance of instances) instance.unmountUnmounted();
  instances.clear();
}

/**
 * Insert `instance` into a depth-ordered queue: deepest at index 0,
 * shallowest at the tail so `pop()` yields the topmost ancestor first.
 * No-ops if `instance` is already a member; tail fast-path covers the
 * common "incoming is at or shallower than current shallowest" case.
 */
function insertSorted(
  groups: QueueGroup[],
  members: Set<BaseInstance>,
  instance: BaseInstance,
): void {
  if (members.has(instance)) return;
  members.add(instance);
  let lo = 0;
  let hi = groups.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const group = groups[mid]!;
    // Same depth → cluster together (siblings or cousins render order is
    // irrelevant; only parent-before-child matters).
    if (group.depth === instance.depth) {
      group.instances.push(instance);
      return;
    }
    // Deeper instances go earlier in the queue; shallowest end up at the
    // tail so `queue.pop()` yields the topmost ancestor first, giving the
    // render drain parent-before-child order.
    if (instance.depth > group.depth) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  groups.splice(lo, 0, { depth: instance.depth, instances: [instance] });
}

/** Time budget per deferred work slice (ms), matching React 19. */
const SLICE_MS = 10;
type QueueGroup = {
  depth: number;
  instances: Array<BaseInstance>;
};

export class Scheduler {
  private renderPrimaryGroups: QueueGroup[] = [];
  private renderPrimaryMembers = new Set<BaseInstance>();

  private renderDeferredGroups: QueueGroup[] = [];
  private renderDeferredMembers = new Set<BaseInstance>();

  private primaryInstancesWithUnmounted = new Set<BaseInstance>();
  private deferredInstancesWithUnmounted = new Set<BaseInstance>();

  private domPrimaryMembers = new Set<BaseInstance>();
  private domPrimaryGroups: QueueGroup[] = [];

  private domDeferredMembers = new Set<BaseInstance>();
  private domDeferredGroups: QueueGroup[] = [];

  private effectPrimaryGroups: QueueGroup[] = [];
  private effectPrimaryMembers = new Set<BaseInstance>();

  private effectDeferredGroups: QueueGroup[] = [];
  private effectDeferredMembers = new Set<BaseInstance>();

  private resolveGroups: QueueGroup[] = [];
  private resolveMembers = new Set<BaseInstance>();

  private batchDepth = 0;

  private resolvable = createResolvable();

  constructor() {
    void this.resolvable.promise.then(this.run);
  }

  scheduleRender(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) insertSorted(this.renderDeferredGroups, this.renderDeferredMembers, instance);
    else insertSorted(this.renderPrimaryGroups, this.renderPrimaryMembers, instance);
    this.resolvable.resolve();
  }

  scheduleUnmountChildren(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) this.deferredInstancesWithUnmounted.add(instance);
    else this.primaryInstancesWithUnmounted.add(instance);
  }

  unscheduleUnmountChildren(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) this.deferredInstancesWithUnmounted.delete(instance);
    else this.primaryInstancesWithUnmounted.delete(instance);
  }

  unscheduleRender(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) this.renderDeferredMembers.delete(instance);
    else this.renderPrimaryMembers.delete(instance);
  }

  scheduleEffect(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) insertSorted(this.effectDeferredGroups, this.effectDeferredMembers, instance);
    else insertSorted(this.effectPrimaryGroups, this.effectPrimaryMembers, instance);
    this.resolvable.resolve();
  }

  unscheduleEffect(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) this.effectDeferredMembers.delete(instance);
    else this.effectPrimaryMembers.delete(instance);
  }

  scheduleResolve(instance: BaseInstance): void {
    insertSorted(this.resolveGroups, this.resolveMembers, instance);
    this.resolvable.resolve();
  }

  scheduleDOMUpdate(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) insertSorted(this.domDeferredGroups, this.domDeferredMembers, instance);
    else insertSorted(this.domPrimaryGroups, this.domPrimaryMembers, instance);
  }

  unscheduleDOMUpdate(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) this.domDeferredMembers.delete(instance);
    else this.domPrimaryMembers.delete(instance);
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

  private async checkAwait(): Promise<void> {
    if (Date.now() > BaseInstance.sliceDeadline) {
      const { promise, resolve } = createResolvable<unknown>();
      const { port1, port2 } = new MessageChannel();
      port1.onmessage = resolve;
      port2.postMessage(null);

      await promise;
      BaseInstance.sliceDeadline = Date.now() + SLICE_MS;
    }
  }

  private async tryGc() {
    if (!window.requestIdleCallback) return;
    await new Promise((res) => {
      window.requestIdleCallback(res);
    });
  }

  private run = async (): Promise<void> => {
    while (this.renderPrimaryGroups.length || this.renderDeferredGroups.length) {
      this.runPrimaryQueue();
      updateDOM(this.domPrimaryGroups, this.domPrimaryMembers);
      unmountUnmounted(this.primaryInstancesWithUnmounted);
      runEffects(this.effectPrimaryGroups, this.effectPrimaryMembers);
      await this.checkAwait();
      await this.runDeferredQueue();
    }
    const { resolveGroups, resolveMembers } = this;
    this.resolveMembers = new Set();
    this.resolveGroups = [];

    updateDOM(this.domDeferredGroups, this.domDeferredMembers);
    unmountUnmounted(this.deferredInstancesWithUnmounted);
    runEffects(this.effectDeferredGroups, this.effectDeferredMembers);
    for (const { instances } of resolveGroups) {
      for (const instance of instances) {
        if (resolveMembers.delete(instance)) {
          instance.resolveStatePromises();
        }
      }
    }

    // Only recreate the resolvable when *all* queues are empty. If a
    // `scheduleRender`/`scheduleEffect`/`scheduleResolve` fired during
    // post-processing it called `resolve()` on the (already-settled) old
    // resolvable — a no-op. Re-attaching `.then(this.run)` to that same
    // resolved promise fires `run` again on the next microtask, draining
    // the gap-added work. Recreate only when there's nothing pending so we
    // genuinely wait for the next external schedule.
    if (
      !this.renderPrimaryGroups.length &&
      !this.renderDeferredGroups.length &&
      !this.effectPrimaryGroups.length &&
      !this.effectDeferredGroups.length &&
      !this.resolveGroups.length
    ) {
      this.resolvable = createResolvable();
    }

    await this.resolvable.promise;
    void this.run();
  };

  private runPrimaryQueue() {
    while (this.renderPrimaryGroups.length) {
      const { instances } = this.renderPrimaryGroups[this.renderPrimaryGroups.length - 1]!;
      while (instances.length > 0) {
        const instance = instances.pop()!;
        if (!this.renderPrimaryMembers.delete(instance)) continue;
        if (instance.deferred()) {
          this.scheduleRender(instance);
          continue;
        }
        const gen = instance.apply();
        let res = gen.next();
        while (!res.done) res = gen.next();
      }
      this.renderPrimaryGroups.pop();
    }
  }

  total = 0;

  private async runDeferredQueue() {
    BaseInstance.sliceDeadline = Date.now() + SLICE_MS;
    while (this.renderDeferredGroups.length) {
      const { instances } = this.renderDeferredGroups[this.renderDeferredGroups.length - 1]!;
      while (instances.length) {
        if (this.renderPrimaryMembers.size) return;
        this.total++;
        const instance = instances.pop()!;
        if (!this.renderDeferredMembers.delete(instance)) continue;

        await this.checkAwait();
        if (!instance.deferred()) {
          // Re-route: instance was queued as deferred but its `<Defer>`
          // ancestor has since unmounted/committed, so it now belongs in
          // primary. Symmetric to the primary queue's re-route above.
          this.scheduleRender(instance);
          return;
        }

        const gen = instance.apply();
        let res = gen.next();

        while (!res.done) {
          this.total++;
          if (this.renderPrimaryGroups.length) {
            // Primary work appeared mid-render — preserve our progress and
            // bail so primary can run.
            this.scheduleRender(instance);
            return;
          }
          if (this.total > 10_000) {
            this.total = 0;
            await this.tryGc();
          }
          if (Date.now() > BaseInstance.sliceDeadline) {
            await this.checkAwait();
          }
          res = gen.next();
        }

        // console.log("i", i, this.total);
      }
      if (this.renderDeferredGroups[this.renderDeferredGroups.length - 1].instances === instances) {
        this.renderDeferredGroups.pop();
      } else {
        console.error("STACK NOT UP TO DATE");
      }
    }
  }
}
