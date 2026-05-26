import { ComponentFiber } from "./component-fiber";
import type { DraftBy } from "../general-types";
import type { ContextSlotType, Slot } from "../slots/slot";
import type { ContextMap, RenderContext } from "../render/types";
import type { TagNamespace } from "../render/elements/namespaces";
import type { ContextProperties } from "../context";

function invoke(cb: () => void) {
  cb();
}
export class ContextFiber extends ComponentFiber<{ value: unknown }> {
  context: ContextProperties<unknown>;
  subscribers: Set<() => void> = new Set();

  constructor(
    intent: DraftBy<Slot<ContextSlotType>, "instance" | "prevProps">,
    ctx: ContextMap,
    parent: ComponentFiber | null,
    rctx: RenderContext,
    parentDom: Node,
    ns: TagNamespace,
  ) {
    super(intent, ctx, parent, rctx, parentDom, ns);
    const { context, props } = intent;
    this.context = {
      ref: {
        current: props["value"],
      },
      subscribe: (cb) => {
        this.subscribers.add(cb);
        return () => this.subscribers.delete(cb);
      },
      id: context.id,
      depth: (parent?.depth ?? -1) + 1,
      Provider: context.Provider,
    };
    const extended = new Map(ctx);
    extended.set(context.id, this.context);
    this.ctx = extended;
  }

  override render() {
    super.render();
    const { value } = this.props;
    if (Object.is(value, this.context.ref.current)) return;
    this.context.ref.current = value;
    this.subscribers.forEach(invoke);
  }
}
