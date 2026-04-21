import type { BaseInstance } from "../instances/base-instance";
import type { DomResult, OptionalUpdateResult, ReconcileResult } from "./types";
import { createInstance } from "../instances/create-instance";
import { MOUNT_REASON } from "../render-reasons";

let max = 0;
export function* invokeUpdates(
  parent: BaseInstance,
  generator: Generator<OptionalUpdateResult, ReconcileResult, BaseInstance>,
): Generator<void, ReconcileResult & { domUpdates: DomResult[] }> {
  const domUpdates: Array<DomResult> = [];
  const toBeUnmounted = new Map(parent.children);
  const pendingChildren: Array<{ path: string; instance: BaseInstance }> = [];
  let result = generator.next();
  while (!result.done) {
    yield;
    if (!result.value) {
      result = generator.next();
      continue;
    }
    const next = result.value;
    if (next.type === "DOM") {
      domUpdates.push(next);
      result = generator.next();
      continue;
    }

    switch (next.type) {
      case "MOUNT": {
        const { vnode, index, parentDom } = next;
        const path = JSON.stringify(next.slotPath);
        const instance = parent.children.get(path);
        toBeUnmounted.delete(path);
        if (vnode.type === instance?.vnode.type) {
          instance.remount();
          instance.setProps(vnode);
          result = generator.next(instance);
        } else {
          instance?.unmount();
          const newInstance = createInstance(
            path,
            vnode,
            parent.ctx,
            index,
            parent,
            parent.rctx,
            parentDom,
          );
          pendingChildren.push({ path, instance: newInstance });
          result = generator.next(newInstance);
        }
        break;
      }
      case "SET_PROPS": {
        toBeUnmounted.delete(parent.keysByInstance.get(next.instance)!);
        next.instance.setProps(next.vnode);
        result = generator.next();
        break;
      }
      case "UNMOUNT": {
        next.instance.unmount();
        result = generator.next();
        break;
      }
    }
  }

  const start = Date.now();

  // Generator completed — commit buffered children and clean up orphans.
  for (const { path, instance } of pendingChildren) {
    parent.children.set(path, instance);
    parent.keysByInstance.set(instance, path);
    instance.scheduleApply(MOUNT_REASON);
  }

  for (const [_, removedInstance] of toBeUnmounted) removedInstance.unmount();
  const cur = Date.now() - start;
  if (cur > max) {
    max = cur;
    console.log("MAX", max, toBeUnmounted.size, pendingChildren.length);
  }
  return { ...result.value, domUpdates };
}
