import type { BaseInstance } from "./base-instance";
import type { ContextMap, RenderContext } from "../render/types";
import { ContextInstance } from "./context-instance";
import { DeferredInstance } from "./deferred-instance";
import { Defer } from "./defer-context";
import { ContextSymbol } from "../context";
import { ComponentInstance } from "./component-instance";
import type { TagNamespace } from "../render/elements/namespaces";
import type { ComponentSlotType, ContextSlotType, SlotIntent } from "../slots/slot";

export function createInstance(
  headNode: Comment,
  tailNode: Comment,
  intent: SlotIntent<ContextSlotType | ComponentSlotType>,
  parentCtx: ContextMap,
  parent: BaseInstance | null,
  rctx: RenderContext,
  parentDom: Node,
  ns: TagNamespace,
): BaseInstance {
  const { child, path } = intent;
  if (child.type === Defer) {
    return new DeferredInstance(
      headNode,
      tailNode,
      path,
      child as any,
      parentCtx,
      parent,
      rctx,
      parentDom,
      ns,
    );
  } else if (ContextSymbol in child.type) {
    return new ContextInstance(
      headNode,
      tailNode,
      path,
      child as any,
      parentCtx,
      parent,
      rctx,
      parentDom,
      ns,
    );
  } else {
    return new ComponentInstance(
      headNode,
      tailNode,
      path,
      child,
      parentCtx,
      parent,
      rctx,
      parentDom,
      ns,
    );
  }
}
