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
 * instance decides WHEN to call them via `scheduleRender(reason)` and
 * `unscheduleRender(reason)`, and whether the instance ends up in the
 * queue at all depends on its reason set (see BaseInstance).
 */
import type { BaseInstance } from "../instances/base-instance";

function comparePaths(a: readonly number[], b: readonly number[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return a.length - b.length;
}

export class Scheduler {
  private queue: BaseInstance[] = [];
  private batchDepth = 0;
  private flushing = false;

  schedule(instance: BaseInstance): void {
    if (instance.unmounted) return;
    if (this.queue.includes(instance)) return;
    let i = 0;
    while (i < this.queue.length) {
      const existing = this.queue[i];
      if (!existing) break;
      if (comparePaths(instance.path, existing.path) < 0) break;
      i++;
    }
    this.queue.splice(i, 0, instance);
    if (this.batchDepth === 0) this.flush();
  }

  unschedule(instance: BaseInstance): void {
    const i = this.queue.indexOf(instance);
    if (i >= 0) this.queue.splice(i, 1);
  }

  beginBatch(): void {
    this.batchDepth++;
  }

  endBatch(): void {
    this.batchDepth--;
    if (this.batchDepth === 0) this.flush();
  }

  flush(): void {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.queue.length > 0) {
        const rendered: BaseInstance[] = [];
        while (this.queue.length > 0) {
          const instance = this.queue.shift();
          if (!instance || instance.unmounted) continue;
          instance.render();
          rendered.push(instance);
        }
        for (const instance of rendered) {
          if (!instance.unmounted) instance.afterRender();
        }
      }
    } finally {
      this.flushing = false;
    }
  }
}
