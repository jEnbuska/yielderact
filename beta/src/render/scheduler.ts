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
import type { BaseInstance } from "../instances/base-instance";
import { createResolvable } from "../create-resolvable";
import { $CONTEXT, $EFFECT, $STATE } from "../hooks/descriptors";
import { effectResolver } from "../hooks/effect";
import { stateResolver } from "../hooks/state";
import { removeSlotNodes } from "../reconciler/dom-remove";
import { insertBefore, moveSlot, setText } from "../reconciler/dom-updates";
import { updateElementProps } from "./element-props";

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
  let i = 0;
  while (i < groups.length) {
    const group = groups[i]!;
    if (group.depth! === instance.depth) {
      group.instances.push(instance);
      return;
    }
    if (group.depth < instance.depth) break;
    i++;
  }
  groups.splice(i, 0, { depth: instance.depth, instances: [instance] });
}

function last<T>(array: T[]): T {
  return array[array.length - 1]!;
}

const SLICE_MS = 50;
type QueueGroup = {
  depth: number;
  instances: Array<BaseInstance>;
};

export class Scheduler {
  private readonly syncRenderGroups: QueueGroup[] = [];
  private readonly syncRenderMembers = new Set<BaseInstance>();

  private readonly secondaryRenderGroups: QueueGroup[] = [];
  private readonly secondaryRenderMembers = new Set<BaseInstance>();

  private readonly tertiaryRenderGroups: QueueGroup[] = [];
  private readonly tertiaryRenderMembers = new Set<BaseInstance>();

  private readonly primaryParentsWithUnmounted = new Set<BaseInstance>();
  private readonly secondaryParentsWithUnmounted = new Set<BaseInstance>();

  private readonly domPrimaryMembers = new Set<BaseInstance>();
  private readonly domPrimaryGroups: QueueGroup[] = [];

  private readonly domSecondaryMembers = new Set<BaseInstance>();
  private readonly domSecondaryGroups: QueueGroup[] = [];

  private readonly effectPrimaryGroups: QueueGroup[] = [];
  private readonly effectPrimaryMembers = new Set<BaseInstance>();

  private readonly effectSecondaryGroups: QueueGroup[] = [];
  private readonly effectSecondaryMembers = new Set<BaseInstance>();

  private resolveGroups: QueueGroup[] = [];
  private resolveMembers = new Set<BaseInstance>();

  private batchDepth = 0;

  private resolvable = createResolvable();

  private workYieldDeadline = Infinity;

  constructor() {
    void this.resolvable.promise.then(this.run);
  }

  scheduleRender(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) {
      insertSorted(this.secondaryRenderGroups, this.secondaryRenderMembers, instance);
      this.tertiaryRenderMembers.delete(instance);
    } else {
      insertSorted(this.syncRenderGroups, this.syncRenderMembers, instance);
    }
    this.resolvable.resolve();
  }

  scheduleUnmountChildren(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) this.secondaryParentsWithUnmounted.add(instance);
    else this.primaryParentsWithUnmounted.add(instance);
  }

  unscheduleUnmountChildren(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) this.secondaryParentsWithUnmounted.delete(instance);
    else this.primaryParentsWithUnmounted.delete(instance);
  }

  unscheduleRender(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) this.secondaryRenderMembers.delete(instance);
    else this.syncRenderMembers.delete(instance);
  }

  scheduleEffect(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) insertSorted(this.effectSecondaryGroups, this.effectSecondaryMembers, instance);
    else insertSorted(this.effectPrimaryGroups, this.effectPrimaryMembers, instance);
    this.resolvable.resolve();
  }

  scheduleResolve(instance: BaseInstance): void {
    insertSorted(this.resolveGroups, this.resolveMembers, instance);
    this.resolvable.resolve();
  }

  scheduleDOMUpdate(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) insertSorted(this.domSecondaryGroups, this.domSecondaryMembers, instance);
    else insertSorted(this.domPrimaryGroups, this.domPrimaryMembers, instance);
  }

  unscheduleDOMUpdate(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) this.domSecondaryMembers.delete(instance);
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

  awaitChannel = new MessageChannel();
  private async checkAwait(): Promise<void> {
    if (Date.now() > this.workYieldDeadline) {
      const { promise, resolve } = createResolvable<unknown>();
      const { port1, port2 } = this.awaitChannel;
      port1.onmessage = resolve;
      port2.postMessage(null);
      await promise;
      this.workYieldDeadline = Date.now() + SLICE_MS;
    }
  }

  private run = async (): Promise<void> => {
    while (true) {
      this.workYieldDeadline = Date.now() + SLICE_MS;
      while (
        this.syncRenderMembers.size ||
        this.secondaryRenderMembers.size ||
        this.tertiaryRenderMembers.size
      ) {
        this.processSyncRenderGroups();
        Scheduler.applydomActions(this.domPrimaryGroups);
        this.domPrimaryMembers.clear();
        Scheduler.unmountParentsUnmountedChildren(this.primaryParentsWithUnmounted);
        Scheduler.precessEffects(this.effectPrimaryGroups);
        this.effectPrimaryMembers.clear();
        await this.processAsyncRenderGroups();
        if (this.syncRenderMembers.size) continue;
        await this.processAsyncRenderGroups2();
      }

      Scheduler.setUnmountedChildrenUnmounted(this.secondaryParentsWithUnmounted);
      Scheduler.applydomActions(this.domSecondaryGroups);
      this.domSecondaryMembers.clear();
      const { resolveGroups } = this;
      this.resolveMembers = new Set();
      this.resolveGroups = [];
      Scheduler.unmountParentsUnmountedChildren(this.secondaryParentsWithUnmounted);
      Scheduler.precessEffects(this.effectSecondaryGroups);
      this.effectSecondaryMembers.clear();
      Scheduler.processStates(resolveGroups);
      if (
        !this.syncRenderMembers.size &&
        !this.secondaryRenderMembers.size &&
        !this.tertiaryRenderMembers.size &&
        !this.effectPrimaryMembers.size &&
        !this.effectSecondaryMembers.size &&
        !this.resolveMembers.size
      ) {
        this.resolvable = createResolvable();
      }
      await this.resolvable.promise;
    }
  };

  cleanupInstancesSchedules(instance: BaseInstance, deferred = instance.deferred()): void {
    if (deferred) {
      this.effectSecondaryMembers.delete(instance);
      this.domSecondaryMembers.delete(instance);
    } else {
      this.effectPrimaryMembers.delete(instance);
      this.domPrimaryMembers.delete(instance);
    }
  }

  private processSyncRenderGroups() {
    while (this.syncRenderMembers.size) {
      const { instances } = last(this.syncRenderGroups);
      while (instances.length > 0) {
        const instance = instances.pop()!;

        if (!this.syncRenderMembers.delete(instance)) continue;
        if (instance.isUnmounted()) {
          this.cleanupInstancesSchedules(instance);
          continue;
        }
        if (instance.deferred()) {
          this.scheduleRender(instance);
          continue;
        }
        instance.apply();
      }
      this.syncRenderGroups.pop();
    }
  }

  private async processAsyncRenderGroups() {
    while (this.secondaryRenderMembers.size) {
      const group = last(this.secondaryRenderGroups);
      const instances = group.instances;
      while (instances.length > 0) {
        await this.checkAwait();
        if (this.syncRenderMembers.size) return;
        const instance = instances.pop()!;
        if (!this.secondaryRenderMembers.delete(instance)) continue;
        if (!instance.deferred()) {
          this.scheduleRender(instance);
          return;
        }
        if (instance.isUnmounted()) {
          insertSorted(this.tertiaryRenderGroups, this.tertiaryRenderMembers, instance);
          continue;
        }
        instance.apply();
      }
      this.secondaryRenderGroups.pop();
    }
  }

  private async processAsyncRenderGroups2() {
    while (this.tertiaryRenderMembers.size) {
      const group = last(this.tertiaryRenderGroups);
      const instances = group.instances;
      while (instances.length) {
        await this.checkAwait();
        if (this.syncRenderGroups.length || this.secondaryRenderGroups.length) return;
        const instance = instances.pop()!;

        if (!this.tertiaryRenderMembers.delete(instance)) continue;
        if (instance.isUnmounted()) {
          this.cleanupInstancesSchedules(instance);
          continue;
        }
        if (!instance.deferred()) {
          this.scheduleRender(instance);
          return;
        }
        instance.apply();
      }
      this.tertiaryRenderGroups.pop();
    }
  }

  static setUnmountedChildrenUnmounted(parents: Iterable<BaseInstance>) {
    for (const instance of parents) {
      const { instances, unmountInstances } = instance;
      if (unmountInstances) {
        for (const child of unmountInstances) {
          instances?.delete(child.path);
          Scheduler.setUnmountedRecursively(child);
        }
      }
    }
  }

  static setUnmountedRecursively(instance: BaseInstance) {
    instance.unmounted = true;
    const { instances } = instance;
    if (instances) {
      for (const child of instances.values()) {
        Scheduler.setUnmountedRecursively(child);
      }
    }
  }

  private static unmountParentsUnmountedChildren(parents: Set<BaseInstance>) {
    for (const next of parents) {
      if (!next.unmountInstances?.size) continue;
      const children = next.instances;
      for (const child of next.unmountInstances) {
        Scheduler.unmountLeafsFirst(child);
        children?.delete(child.path);
      }
      next.unmountInstances.clear();
    }
    parents.clear();
  }
  private static unmountLeafsFirst(instance: BaseInstance): void {
    const { instances, hookStates, refs } = instance;
    if (instances) {
      for (const instance of instances.values()) {
        this.unmountLeafsFirst(instance);
      }
    }
    if (refs) {
      for (const [element, ref] of refs) {
        if (element !== ref.current) continue;
        ref.current = undefined;
      }
    }

    if (hookStates) {
      for (const state of hookStates) {
        if (state.type === $EFFECT) {
          state.controller?.abort();
        } else if (state.type === $CONTEXT) {
          state.unsubscribe?.();
        } else if (state.type === $STATE) {
          state.pendingResolve = undefined;
        }
      }
    }
  }

  private static precessEffects(group: QueueGroup[]) {
    for (let i = 0; i < group.length; i++) {
      const { instances } = group[i]!;
      for (const instance of instances) {
        if (instance.unmounted) continue;
        //if (!members.has(instance)) continue;
        instance.mounted = true;
        instance.effectReasons?.clear();
        instance.hookStates?.forEach(effectResolver);
      }
    }
    group.length = 0;
  }

  private static applydomActions(groups: QueueGroup[]) {
    // Remove all unmounted slots
    for (let i = 0; i < groups.length; i++) {
      const { instances } = groups[i]!;
      for (const instance of instances) {
        if (instance.unmounted) continue;
        instance.removedSlots?.forEach(removeSlotNodes);
        instance.removedSlots = undefined;
      }
    }
    for (let i = groups.length - 1; i >= 0; i--) {
      const { instances } = groups[i]!;
      for (const instance of instances) {
        if (instance.unmounted) continue;
        const { domActions, refs, nextRefs } = instance;
        if (domActions) {
          for (const change of domActions) {
            switch (change.type) {
              case "INSERT": {
                const { before, parentDom, node } = change;
                insertBefore(parentDom, node, before);
                break;
              }
              case "MOVE": {
                const { slot, parentDom, before } = change;
                moveSlot(slot, parentDom, before);
                break;
              }
              case "TEXT": {
                const { node, text } = change;
                setText(node, text);
                break;
              }
              case "UPDATE": {
                const { node, patch } = change;
                updateElementProps(node, patch, instance.rctx.delegationRoot);
                break;
              }
            }
          }
        }
        instance.domActions = undefined;
        instance.slot = instance.pendingSlots;
        if (refs) {
          for (const [element, ref] of refs) {
            if (nextRefs?.get(element) === ref) continue; // unchanged binding
            if (ref.current === element) ref.current = undefined; // still ours to clear
          }
        }
        // Pass 2: assign all new refs
        if (nextRefs) {
          for (const [element, ref] of nextRefs) {
            ref.current = element;
          }
        }
        instance.refs = instance.nextRefs;
        instance.nextRefs = undefined;
      }
    }
    groups.length = 0;
  }

  private static processStates(resolveGroups: QueueGroup[]) {
    for (const { instances } of resolveGroups) {
      for (const instance of instances) {
        if (instance.unmounted) continue;
        instance.resolveReasons?.clear();
        instance.hookStates?.forEach(stateResolver);
      }
    }
  }
}
