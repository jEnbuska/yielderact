import { ComponentFiber } from "./component-fiber";
import type { DraftBy } from "../general-types";
import type { ContextSlotType, Slot } from "../slots/slot";
import type { ContextMap, RenderContext } from "../render/types";
import type { TagNamespace } from "../render/elements/namespaces";
import type { ContextProperties } from "../context";
import { depsChanged } from "../general";
import { PROPS_REASON } from "../render-reasons";
import type { ContextHookState } from "../hooks/context";

export class ContextFiber extends ComponentFiber<{ value: unknown }> {
  context: ContextProperties<unknown>;
  subscribers: Set<ContextHookState> = new Set();

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
      name: context.name,
      version: 0,
      ref: {
        current: props["value"],
      },
      subscribe: (cb) => {
        this.subscribers.add(cb);
        return () => this.subscribers.delete(cb);
      },
      depth: (parent?.depth ?? -1) + 1,
      id: context.id,
      Provider: context.Provider,
    };
    const extended = new Map(ctx);
    extended.set(context.id, this.context);
    this.ctx = extended;
    this.propsPrepared = false;
  }

  override render() {
    const { value } = this.props;
    const prevValue = this.context.ref.current;

    this.context.ref.current = value; // Should this be after Object.is(...) ?
    super.render();
    if (Object.is(prevValue, this.context.ref.current)) return;
    this.context.version++;
    this.subscribers.forEach((sub) => sub.callback?.());
  }

  override setProps(
    intent: Omit<DraftBy<Slot<ContextSlotType>, "instance" | "prevProps">, "type">,
  ): void {
    const { deps } = intent.props;
    if (!depsChanged(this.deps, deps)) return;
    this.deps = deps;
    this.props = intent.props;
    this.scheduleRender(PROPS_REASON);
  }

  notifyContextProviders() {
    const { version } = this.context;
    for (const sub of this.subscribers) {
      if (sub.version === version) continue;
      sub.callback?.();
    }
  }
}
