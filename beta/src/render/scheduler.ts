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
import type { ComponentFiber } from "../instances/component-fiber";
import { createResolvable } from "../create-resolvable";
import { $CONTEXT, $EFFECT, $STATE } from "../hooks/descriptors";
import { effectResolver } from "../hooks/effect";
import { stateResolver } from "../hooks/state";
import { insertBefore, moveSlot, removeSlotNodes } from "../reconciler/dom-updates";
import { updateElementProps } from "./element-props";

/**
 * Insert `instance` into a depth-ordered queue: deepest at index 0,
 * shallowest at the tail so `pop()` yields the topmost ancestor first.
 * No-ops if `instance` is already a member; tail fast-path covers the
 * common "incoming is at or shallower than current shallowest" case.
 */
function insertSorted(groups: Group, instance: ComponentFiber): void {
  const { depth } = instance;
  const { members } = groups;
  if (members.has(instance)) return;
  members.add(instance);
  const { queues } = groups;
  while (queues.length <= depth) {
    queues.push([]);
  }
  queues[depth]!.push(instance);
}

function last<T>(array: T[]): T {
  return array[array.length - 1]!;
}

const SLICE_MS = 20;

type Group = {
  queues: Array<Array<ComponentFiber>>;
  members: Set<ComponentFiber>;
};

export class Scheduler {
  private readonly primaryRenderGroup: Group = { queues: [], members: new Set() };
  private readonly secondaryRenderGroup: Group = { queues: [], members: new Set() };
  private readonly tertiaryRenderGroup: Group = { queues: [], members: new Set() };

  private readonly primaryParentsWithUnmounted = new Set<ComponentFiber>();
  private readonly secondaryParentsWithUnmounted = new Set<ComponentFiber>();

  private readonly uiPrimaryGroup: Group = { queues: [], members: new Set() };
  private readonly uiSecondaryGroup: Group = { queues: [], members: new Set() };

  private readonly effectPrimaryGroup: Group = { queues: [], members: new Set() };
  private readonly effectSecondaryGroup: Group = { queues: [], members: new Set() };

  private resolveGroup: Group = { queues: [], members: new Set() };

  private batchDepth = 0;

  private resolvable = createResolvable();

  private workYieldDeadline = Infinity;

  constructor() {
    void this.resolvable.promise.then(this.run);
  }

  scheduleRender(instance: ComponentFiber, deferred = instance.deferred()): void {
    if (deferred) {
      insertSorted(this.secondaryRenderGroup, instance);
      this.tertiaryRenderGroup.members.delete(instance);
    } else {
      insertSorted(this.primaryRenderGroup, instance);
    }
    this.resolvable.resolve();
  }

  scheduleUnmountChildren(instance: ComponentFiber, deferred = instance.deferred()): void {
    if (deferred) this.secondaryParentsWithUnmounted.add(instance);
    else this.primaryParentsWithUnmounted.add(instance);
  }

  unscheduleUnmountChildren(instance: ComponentFiber, deferred = instance.deferred()): void {
    if (deferred) this.secondaryParentsWithUnmounted.delete(instance);
    else this.primaryParentsWithUnmounted.delete(instance);
  }

  unscheduleRender(instance: ComponentFiber, deferred = instance.deferred()): void {
    if (deferred) this.secondaryRenderGroup.members.delete(instance);
    else this.primaryRenderGroup.members.delete(instance);
  }

  scheduleEffect(instance: ComponentFiber, deferred = instance.deferred()): void {
    if (deferred) insertSorted(this.effectSecondaryGroup, instance);
    else insertSorted(this.effectPrimaryGroup, instance);
    this.resolvable.resolve();
  }

  scheduleResolve(instance: ComponentFiber): void {
    insertSorted(this.resolveGroup, instance);
    this.resolvable.resolve();
  }

  scheduleDOMUpdate(instance: ComponentFiber, deferred = instance.deferred()): void {
    if (deferred) insertSorted(this.uiSecondaryGroup, instance);
    else insertSorted(this.uiPrimaryGroup, instance);
  }

  unscheduleDOMUpdate(instance: ComponentFiber, deferred = instance.deferred()): void {
    if (deferred) this.uiSecondaryGroup.members.delete(instance);
    else this.uiPrimaryGroup.members.delete(instance);
  }

  unscheduleResolve(instance: ComponentFiber): void {
    this.resolveGroup.members.delete(instance);
  }

  beginBatch = () => {
    this.batchDepth++;
  };

  endBatch = () => {
    this.batchDepth--;
    if (this.batchDepth === 0) void this.resolvable.resolve();
  };

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
      const {
        uiPrimaryGroup,
        uiSecondaryGroup,
        primaryRenderGroup,
        secondaryRenderGroup,
        tertiaryRenderGroup,
        effectPrimaryGroup,
        effectSecondaryGroup,
        primaryParentsWithUnmounted,
        secondaryParentsWithUnmounted,
      } = this;

      while (
        primaryRenderGroup.members.size ||
        secondaryRenderGroup.members.size ||
        tertiaryRenderGroup.members.size
      ) {
        this.processPrimaryRenderGroups();
        Scheduler.applyUiActions(uiPrimaryGroup);
        Scheduler.unmountParentsUnmountedChildren(primaryParentsWithUnmounted);
        Scheduler.precessEffects(effectPrimaryGroup);
        await this.processSecondaryRenderGroups();
        if (primaryRenderGroup.members.size) continue;
        await this.processTertiaryRenderGroups();
      }
      Scheduler.setUnmountedChildrenUnmounted(secondaryParentsWithUnmounted);
      const start = Date.now();
      const show = uiSecondaryGroup.members.size;
      Scheduler.applyUiActions(uiSecondaryGroup);
      secondaryRenderGroup.members.clear();
      const { resolveGroup } = this;
      this.resolveGroup = { members: new Set(), queues: [] };
      Scheduler.unmountParentsUnmountedChildren(secondaryParentsWithUnmounted);
      Scheduler.precessEffects(effectSecondaryGroup);
      Scheduler.processStates(resolveGroup);
      if (show) console.log(Date.now() - start);
      if (
        !primaryRenderGroup.members.size &&
        !secondaryRenderGroup.members.size &&
        !tertiaryRenderGroup.members.size &&
        !effectPrimaryGroup.members.size &&
        !effectSecondaryGroup.members.size &&
        !this.resolveGroup.members.size
      ) {
        this.resolvable = createResolvable();
      }
      await this.resolvable.promise;
    }
  };

  cleanupInstancesSchedules(instance: ComponentFiber, deferred: boolean): void {
    if (deferred) {
      this.effectSecondaryGroup.members.delete(instance);
      this.uiSecondaryGroup.members.delete(instance);
    } else {
      this.effectPrimaryGroup.members.delete(instance);
      this.uiPrimaryGroup.members.delete(instance);
    }
  }

  private processPrimaryRenderGroups() {
    const { members, queues } = this.primaryRenderGroup;
    while (members.size) {
      const group = last(queues);
      if (!group.length) queues.pop();
      while (group.length) {
        const next = group.pop()!;
        if (!members.delete(next)) continue;
        if (next.isUnmounted()) {
          this.cleanupInstancesSchedules(next, false);
          continue;
        }
        next.render();
      }
    }
    queues.length = 0;
  }

  private async processSecondaryRenderGroups() {
    const { members: primaryMembers } = this.primaryRenderGroup;
    const { members, queues } = this.secondaryRenderGroup;
    while (members.size) {
      const group = last(queues);
      if (!group.length) {
        queues.pop();
        continue;
      }
      while (group.length) {
        await this.checkAwait();
        if (primaryMembers.size) return;
        const next = group.pop()!;
        if (!members.delete(next)) continue;
        if (!next.deferred()) {
          this.scheduleRender(next);
          return;
        }
        if (next.isUnmounted()) {
          insertSorted(this.tertiaryRenderGroup, next);
          continue;
        }
        next.render();
      }
    }
    queues.length = 0;
  }

  private async processTertiaryRenderGroups() {
    const { members: primaryMembers } = this.primaryRenderGroup;
    const { members: secondaryMembers } = this.secondaryRenderGroup;
    const { members, queues } = this.tertiaryRenderGroup;
    while (members.size) {
      const group = last(queues);
      if (!group.length) {
        queues.pop();
        continue;
      }
      while (group.length) {
        await this.checkAwait();
        if (primaryMembers.size || secondaryMembers.size) return;
        const next = group.pop()!;
        if (!members.delete(next)) continue;
        if (next.isUnmounted()) {
          this.cleanupInstancesSchedules(next, true);
          continue;
        }
        if (!next.deferred()) {
          this.scheduleRender(next);
          return;
        }
        next.render();
      }
    }
    queues.length = 0;
  }

  static setUnmountedChildrenUnmounted(parents: Iterable<ComponentFiber>) {
    for (const next of parents) {
      const { instances, unmountInstances } = next;
      if (unmountInstances) {
        for (const child of unmountInstances) {
          instances?.delete(child.path);
          Scheduler.setUnmountedRecursively(child);
        }
      }
    }
  }

  static setUnmountedRecursively(instance: ComponentFiber) {
    instance.unmounted = true;
    const { instances } = instance;
    if (instances) {
      for (const child of instances.values()) {
        Scheduler.setUnmountedRecursively(child);
      }
    }
  }

  private static unmountParentsUnmountedChildren(parents: Set<ComponentFiber>) {
    for (const next of parents) {
      if (next.unmountInstances) {
        for (const child of next.unmountInstances) Scheduler.unmountLeafsFirst(child);
        next.unmountInstances.clear();
      }
    }
    parents.clear();
  }
  private static unmountLeafsFirst(next: ComponentFiber): void {
    const { instances, hookStates, refs } = next;
    if (instances) {
      for (const next of instances.values()) {
        this.unmountLeafsFirst(next);
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

  private static precessEffects({ queues, members }: Group) {
    members.clear();
    for (let i = queues.length - 1; i >= 0; i--) {
      const group = queues[i]!;
      for (const next of group) {
        if (next.unmounted) continue;
        //if (!members.has(instance)) continue;
        next.mounted = true;
        next.effectReasons?.clear();
        next.hookStates?.forEach(effectResolver);
      }
      group.length = 0;
    }
  }

  private static applyUiActions({ queues, members }: Group) {
    members.clear();
    for (let i = 0; i < queues.length; i++) {
      const group = queues[i]!;
      for (const next of group) {
        if (next.unmounted) continue;
        next.preparedSlots?.clear();
        const { uiActions, refs, nextRefs } = next;
        if (uiActions?.length) {
          for (const action of uiActions) {
            switch (action.type) {
              case "MOVE": {
                moveSlot(action.slot, action.parentDom, action.before);
                break;
              }
              case "REMOVE":
                removeSlotNodes(action.slot);
                break;
              case "INSERT":
                insertBefore(action.parentDom, action.node, action.before);
                break;
              case "TEXT": {
                const { slot } = action;
                slot.headNode.textContent = slot.text;
                break;
              }
              case "UPDATE": {
                const { slot, patch } = action;
                updateElementProps(slot.headNode, patch, next.rctx.delegationRoot);
                break;
              }
            }
          }
          next.slot = next.pendingSlot;
          next.uiActions = undefined;
        }

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
        next.refs = next.nextRefs;
        next.nextRefs = undefined;
      }
      group.length = 0;
    }
  }

  private static processStates({ queues }: Group) {
    for (const group of queues) {
      for (const next of group) {
        if (next.unmounted) continue;
        next.resolveReasons?.clear();
        next.hookStates?.forEach(stateResolver);
      }
    }
  }
}
