import { Scheduler } from "./scheduler";
import { DelegationRoot } from "./delegation";
import type { RenderContext } from "./types";
import { dispatchDelegatedEvent } from "./dispatch";
import { createFiber } from "../instances/create-fiber";
import type { Child } from "../jsx";
import { ComponentFiber } from "../instances/component-fiber";
import { nodeNameSpace } from "./elements/namespaces";
import type { DraftBy } from "../general-types";
import type { ComponentSlotType, Slot } from "../slots/slot";
import { componentSlotType } from "../slots/slot";
import { emptyChildren } from "../slots/slot-intent";
import { emptyMap } from "../general";
import { registerCreateInstance } from "../instances/register-create";

// Just a hack to fix circular imports
registerCreateInstance(createFiber);

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

  render(child: Child) {
    this.rootInstance.run(child);
  }

  /** Tear down the root and clean up event listeners. */
  unmount(): void {
    this.rootInstance.unmount();
    this.container.textContent = "";
    this.delegationRoot.dispose();
  }
}

class RootInstance extends ComponentFiber {
  child: Child = null;
  constructor(rctx: RenderContext) {
    const headNode = document.createComment("<Root>");
    const tailNode = document.createComment("</Root>");
    const ns = nodeNameSpace(rctx.container);
    const intent: DraftBy<Slot<ComponentSlotType>, "instance" | "prevProps"> = {
      children: emptyChildren,
      component: function* Root() {
        return getChild();
      },
      context: undefined,
      deps: undefined,
      element: undefined,
      headNode,
      index: 0,
      instance: undefined,
      key: "root",
      move: undefined,
      path: "",
      prevProps: undefined,
      prevText: undefined,
      props: {},
      slots: emptyMap,
      tailNode: tailNode,
      text: undefined,
      type: componentSlotType,
    };
    super(intent, new Map(), null, rctx, rctx.container, ns);
    const getChild = () => this.child;
  }

  run(child: Child) {
    this.child = child;
    this.parentDom.appendChild(this.headNode);
    this.parentDom.appendChild(this.tailNode);
    this.render();
  }
}
