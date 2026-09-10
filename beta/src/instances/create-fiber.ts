import { ComponentFiber } from "./component-fiber";
import type { ContextMap, RenderContext } from "../render/types";
import type { TagNamespace } from "../render/elements/namespaces";
import type { ComponentSlotType, ContextSlotType, Slot } from "../slots/slot";
import { contextSlotType } from "../slots/slot";
import type { DraftBy } from "../general-types";
import { ContextFiber } from "./context-fiber";
import { Defer } from "../hooks/defer";

export function createFiber(
  intent: DraftBy<Slot<ComponentSlotType | ContextSlotType>, "instance" | "prevProps">,
  parentCtx: ContextMap,
  parent: ComponentFiber | null,
  rctx: RenderContext,
  parentDom: Node,
  ns: TagNamespace,
): ComponentFiber {
  if (intent.component === Defer) {
    return new Defer.Fiber(
      intent as DraftBy<Slot<ComponentSlotType>, "instance" | "prevProps">,
      parentCtx,
      parent,
      rctx,
      parentDom,
      ns,
    );
  }

  if (intent.type === contextSlotType) {
    return new ContextFiber(
      intent as DraftBy<Slot<ContextSlotType>, "instance" | "prevProps">,
      parentCtx,
      parent,
      rctx,
      parentDom,
      ns,
    );
  }
  return new ComponentFiber(
    intent as DraftBy<Slot<ComponentSlotType>, "instance" | "prevProps">,
    parentCtx,
    parent,
    rctx,
    parentDom,
    ns,
  );
}
