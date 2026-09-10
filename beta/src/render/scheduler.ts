import type { ComponentFiber } from "../instances/component-fiber";
import { createResolvable } from "../create-resolvable";
import { effectResolver } from "../hooks/effect";
import { stateResolver } from "../hooks/state";
import { insertBefore, moveSlot, removeSlotNodes } from "../reconciler/dom-updates";
import { updateElementProps } from "./element-props";
import { $EFFECT, $STATE } from "../hooks/constants";

function insertSorted(groups: Group, instance: ComponentFiber): void {
  const { depth } = instance;
  const { members } = groups;
  const scheduled = members.get(instance);
  if (scheduled) return;
  members.set(instance, true);
  if (scheduled === false) return;
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

type Group<T extends ComponentFiber = ComponentFiber> = {
  queues: Array<Array<T>>;
  members: Map<T, boolean>;
};

function createPrimaryRenderResolvable(): PromiseWithResolvers<void> & { subscribed: boolean } {
  return Object.assign(createResolvable(), { subscribed: false });
}

export class Scheduler {
  private _rendering = "";
  get rendering() {
    return this._rendering;
  }

  private readonly primaryRenderGroup: Group = { queues: [], members: new Map() };
  private readonly secondaryRenderGroup: Group = { queues: [], members: new Map() };

  private readonly tertiaryRenderGroup: Group = { queues: [], members: new Map() };

  private readonly syncParentsWithUnmounted = new Set<ComponentFiber>();
  private readonly deferredParentsWithUnmounted = new Set<ComponentFiber>();

  private readonly uiSyncGroup: Group = { queues: [], members: new Map() };
  private readonly uiDeferredGroup: Group = { queues: [], members: new Map() };

  private readonly effectSyncGroup: Group = { queues: [], members: new Map() };
  private readonly effectDeferredGroup: Group = { queues: [], members: new Map() };

  private resolveGroup: Group = { queues: [], members: new Map() };

  private resolvable = createResolvable();
  private primaryRenderResolvable = createPrimaryRenderResolvable();

  private workYieldDeadline = Infinity;

  constructor() {
    void this.resolvable.promise.then(this.run);
  }

  scheduleRender(instance: ComponentFiber, deferred = instance.isDeferred()): void {
    if (deferred) {
      insertSorted(this.secondaryRenderGroup, instance);
      this.tertiaryRenderGroup.members.delete(instance);
    } else {
      insertSorted(this.primaryRenderGroup, instance);
      if (this.primaryRenderResolvable.subscribed) {
        this.primaryRenderResolvable.resolve();
        this.primaryRenderResolvable = createPrimaryRenderResolvable();
      }
    }
    this.resolvable.resolve();
  }

  scheduleUnmountChildren(instance: ComponentFiber, deferred = instance.isDeferred()): void {
    if (deferred) this.deferredParentsWithUnmounted.add(instance);
    else this.syncParentsWithUnmounted.add(instance);
  }

  unscheduleUnmountChildren(instance: ComponentFiber, deferred = instance.isDeferred()): void {
    if (deferred) this.deferredParentsWithUnmounted.delete(instance);
    else this.syncParentsWithUnmounted.delete(instance);
  }

  unscheduleRender(instance: ComponentFiber, deferred = instance.isDeferred()): void {
    if (deferred) this.secondaryRenderGroup.members.delete(instance);
    else this.primaryRenderGroup.members.delete(instance);
  }

  scheduleEffect(instance: ComponentFiber, deferred = instance.isDeferred()): void {
    if (deferred) insertSorted(this.effectDeferredGroup, instance);
    else insertSorted(this.effectSyncGroup, instance);
    this.resolvable.resolve();
  }

  scheduleResolve(instance: ComponentFiber): void {
    insertSorted(this.resolveGroup, instance);
    this.resolvable.resolve();
  }

  unscheduleResolve(instance: ComponentFiber): void {
    this.resolveGroup.members.delete(instance);
  }

  scheduleUiUpdate(instance: ComponentFiber, deferred = instance.isDeferred()): void {
    if (deferred) insertSorted(this.uiDeferredGroup, instance);
    else insertSorted(this.uiSyncGroup, instance);
  }

  unscheduleUiUpdate(instance: ComponentFiber, deferred = instance.isDeferred()): void {
    if (deferred) this.uiDeferredGroup.members.delete(instance);
    else this.uiSyncGroup.members.delete(instance);
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

      const {
        uiSyncGroup,
        uiDeferredGroup,
        primaryRenderGroup,
        secondaryRenderGroup,
        tertiaryRenderGroup,
        effectSyncGroup,
        effectDeferredGroup,
        syncParentsWithUnmounted,
        deferredParentsWithUnmounted,
      } = this;
      while (
        primaryRenderGroup.members.size ||
        secondaryRenderGroup.members.size ||
        tertiaryRenderGroup.members.size
      ) {
        this.processPrimaryRenderGroups();
        Scheduler.applyUiActions(uiSyncGroup);
        Scheduler.unmountParentsUnmountedChildren(syncParentsWithUnmounted);
        Scheduler.precessEffects(effectSyncGroup);
        await this.processSecondaryRenderGroups();
        if (primaryRenderGroup.members.size) continue;
        await this.processTertiaryRenderGroups();
      }
      Scheduler.setUnmountedChildrenUnmounted(deferredParentsWithUnmounted);
      Scheduler.applyUiActions(uiDeferredGroup);
      secondaryRenderGroup.members.clear();
      const { resolveGroup } = this;
      this.resolveGroup = { members: new Map(), queues: [] };

      Scheduler.unmountParentsUnmountedChildren(deferredParentsWithUnmounted);
      Scheduler.precessEffects(effectDeferredGroup);
      Scheduler.processStates(resolveGroup);
      if (
        !primaryRenderGroup.members.size &&
        !secondaryRenderGroup.members.size &&
        !tertiaryRenderGroup.members.size &&
        !effectSyncGroup.members.size &&
        !effectDeferredGroup.members.size &&
        !this.resolveGroup.members.size
      ) {
        this.resolvable = createResolvable();
      }
      await this.resolvable.promise;
    }
  };

  cleanupInstancesSchedules(instance: ComponentFiber, deferred: boolean): void {
    if (deferred) {
      this.effectDeferredGroup.members.delete(instance);
      this.uiDeferredGroup.members.delete(instance);
    } else {
      this.effectSyncGroup.members.delete(instance);
      this.uiSyncGroup.members.delete(instance);
    }
  }

  private renderFiber(next: ComponentFiber) {
    this._rendering = next.component.name;
    next.render();
    this._rendering = "";
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

        this.renderFiber(next);
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
        if (primaryMembers.size) return;
        const next = group.pop()!;
        const scheduled = members.get(next);
        if (scheduled === undefined) continue;
        members.delete(next);
        if (!scheduled) continue;
        if (next.isUnmounted()) {
          insertSorted(this.tertiaryRenderGroup, next);
          continue;
        }
        if (!next.isDeferred()) return this.scheduleRender(next);
        this.renderFiber(next);
        await this.checkAwait();
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
        if (primaryMembers.size || secondaryMembers.size) return;
        const next = group.pop()!;
        if (!members.delete(next)) continue;
        if (next.isUnmounted()) {
          this.cleanupInstancesSchedules(next, true);
          continue;
        }
        if (!next.isDeferred()) return this.scheduleRender(next);
        this.renderFiber(next);
        await this.checkAwait();
      }
    }
    queues.length = 0;
  }

  static setUnmountedChildrenUnmounted(parents: Iterable<ComponentFiber>) {
    for (const next of parents) {
      const { instances, unmountInstances } = next;
      if (unmountInstances) {
        for (const child of unmountInstances.values()) {
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
        for (const child of next.unmountInstances.values()) Scheduler.unmountLeafsFirst(child);
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
        switch (state.type) {
          case $EFFECT:
            state.controller?.abort();
            break;
          case $STATE:
            state.pendingResolve = undefined;
            break;
        }
      }
    }
  }

  private static precessEffects({ queues, members }: Group) {
    for (let i = queues.length - 1; i >= 0; i--) {
      const group = queues[i]!;
      for (const next of group) {
        if (next.unmounted) continue;
        if (!members.get(next)) continue;
        next.effectReasons?.clear();
        next.hookStates?.forEach(effectResolver);
      }
      group.length = 0;
    }
    members.clear();
  }

  private static applyUiActions({ queues, members }: Group) {
    members.clear();
    for (let i = 0; i < queues.length; i++) {
      const queue = queues[i]!;
      for (const next of queue) {
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
      queue.length = 0;
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
