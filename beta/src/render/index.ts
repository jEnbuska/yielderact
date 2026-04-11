/**
 * Public render entry points.
 *
 * `createRoot(container)` wires up one Scheduler + one DelegationRoot for
 * the container, returns a `Root` handle, and lets the caller mount/unmount
 * VNodes into it. `render(vnode, container)` is a one-shot convenience
 * wrapper that creates a Root, mounts `vnode`, and returns the Root.
 */
import { dispatchDelegatedEvent } from "./dispatch";
import { DelegationRoot } from "./delegation";
import { RootInstance } from "../instances/root-instance";
import type { VNode } from "../jsx";
import { reconcileChildren, unmountSlot } from "./reconciler";
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
      this.rootInstance.slots = reconcileChildren(
        this.rootInstance,
        this.container,
        this.rootInstance.slots,
        [vnode],
        null,
      );
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
