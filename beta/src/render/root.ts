import { Scheduler } from "./scheduler";
import { DelegationRoot } from "./delegation";
import type { RenderContext } from "./types";
import { RootInstance } from "../instances/root-instance";
import { dispatchDelegatedEvent } from "./dispatch";
import type { VNode } from "../jsx";
import { createInstance } from "../instances/create-instance";
import { registerCreateInstance } from "../reconciler/reconciler";

registerCreateInstance(createInstance);

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
    this.rootInstance.run(vnode);
  }

  /** Tear down the root and clean up event listeners. */
  unmount(): void {
    this.rootInstance.unmount();
    this.container.textContent = "";
    this.delegationRoot.dispose();
  }
}
