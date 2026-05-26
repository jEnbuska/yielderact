import { ComponentFiber } from "./component-fiber";
import type { ContextProperties } from "../context";
import { createContext, resolveContext } from "../context";
import type { ContextMap, RenderContext } from "../render/types";
import type { TagNamespace } from "../render/elements/namespaces";
import type { ComponentSlotType, Slot } from "../slots/slot";
import type { DraftBy } from "../general-types";
import { $EFFECT } from "../hooks/descriptors";

export const Defer = createContext(false);
Defer.id = "defer-context";

export class DeferredFiber extends ComponentFiber {
  readonly context: ContextProperties<boolean>;

  constructor(
    intent: DraftBy<Slot<ComponentSlotType>, "instance" | "prevProps">,
    parentCtx: ContextMap,
    parent: ComponentFiber | null,
    rctx: RenderContext,
    parentDom: Node,
    ns: TagNamespace,
  ) {
    const context: ContextProperties<boolean> = {
      ref: { current: resolveContext(parentCtx, Defer) },
      subscribe: () => {
        return () => {};
      },
      depth: (parent?.depth ?? -1) + 1,
      id: Defer.id,
      Provider: Defer.Provider,
    };
    const extended = new Map(parentCtx);
    extended.set(Defer.id, context);
    super(intent, extended, parent, rctx, parentDom, ns);
    this.context = context;
    this.hookStates = [
      {
        type: $EFFECT,
        deps: [],
        identifier: Symbol($EFFECT),
        fn: () => {},
        dirty: true,
      },
    ];
  }

  override render() {
    this.context.ref.current = this.deferred();
    super.render();
    if (this.context.ref.current) {
      this.rctx.scheduler.scheduleEffect(this);
    }
  }

  override deferred(): boolean {
    return this.mounted || resolveContext(this.parent?.ctx, Defer);
  }
}
