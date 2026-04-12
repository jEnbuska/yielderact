/**
 * Public render entry points.
 *
 * `createRoot(container)` wires up one Scheduler + one DelegationRoot for
 * the container, returns a `Root` handle, and lets the caller mount/unmount
 * VNodes into it. `render(vnode, container)` is a one-shot convenience
 * wrapper that creates a Root, mounts `vnode`, and returns the Root.
 */

import { RootInstance } from "../instances/root-instance";
import type { VNode } from "../jsx";
import { DelegationRoot } from "./delegation";
import { dispatchDelegatedEvent } from "./dispatch";
import { type AnyCallbackResult, applyCallbacks, reconcile, unmountSlot } from "./reconciler";
import { Scheduler } from "./scheduler";
import type { RenderContext } from "./types";

export class Root {
  readonly container: Element;
  private readonly scheduler: Scheduler;
  private readonly delegationRoot: DelegationRoot;
  private readonly rctx: RenderContext;
  private readonly rootInstance: RootInstance;

  constructor(container: Element) {
    this.container = container;
    this.scheduler = new Scheduler();
    this.delegationRoot = new DelegationRoot(container, (native, name) =>
      dispatchDelegatedEvent(native, container, name, this.scheduler),
    );
    this.rctx = {
      container,
      scheduler: this.scheduler,
      delegationRoot: this.delegationRoot,
    };
    this.rootInstance = new RootInstance(this.rctx);
  }

  /** Mount (or update) `vnode` into the root container. */
  render(vnode: VNode): void {
    this.scheduler.beginBatch();
    try {
      const gen = reconcile(
        [vnode],
        this.rootInstance,
        this.container,
        null,
        this.rootInstance.slots,
        this.rootInstance.keyIndex,
      );
      const callbacks: AnyCallbackResult[] = [];
      let result = gen.next();
      while (!result.done) {
        callbacks.push(result.value);
        result = gen.next();
      }
      const { slots, keyIndex } = result.value;
      this.rootInstance.slots = slots;
      this.rootInstance.keyIndex = keyIndex;
      applyCallbacks(callbacks);
    } finally {
      this.scheduler.endBatch();
    }
  }

  /** Tear down the root and clean up event listeners. */
  unmount(): void {
    this.rootInstance.unmount();
    for (const slot of this.rootInstance.slots) {
      unmountSlot(slot);
    }
    this.container.textContent = "";
    this.delegationRoot.dispose();
  }
}

export function createRoot(container: Element): Root {
  return new Root(container);
}

export function render(vnode: VNode, container: Element): Root {
  const root = new Root(container);
  root.render(vnode);
  return root;
}
