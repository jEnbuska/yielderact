import type { BaseInstance } from "./base-instance";
import type { ContextMap, RenderContext } from "../render/types";
import { ContextInstance } from "./context-instance";
import { DeferredInstance } from "./deferred-instance";
import { Defer } from "./defer-context";
import type { Context } from "../context";
import { isContext } from "../context";
import type { Component, VNode } from "../jsx";
import { ComponentInstance } from "./component-instance";
import type { TagNamespace } from "../render/elements/namespaces";

export function createInstance<T extends Context | Component>(
  childId: string,
  vnode: VNode<T>,
  parentCtx: ContextMap,
  parent: BaseInstance | null,
  rctx: RenderContext,
  parentDom: Node,
  ns: TagNamespace,
): BaseInstance<T> {
  if (vnode.type === Defer) {
    return new DeferredInstance(
      childId,
      vnode as any,
      parentCtx,
      parent,
      rctx,
      parentDom,
      ns,
    ) as any;
  }
  if (isContext(vnode.type)) {
    return new ContextInstance(
      childId,
      vnode as any,
      parentCtx,
      parent,
      rctx,
      parentDom,
      ns,
    ) as any;
  }

  return new ComponentInstance(
    childId,
    vnode as any,
    parentCtx,
    parent,
    rctx,
    parentDom,
    ns,
  ) as any;
}
