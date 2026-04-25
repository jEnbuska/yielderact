import type { BaseInstance } from "./base-instance";
import type { ContextMap, RenderContext } from "../render/types";
import { ContextInstance } from "./context-instance";
import { DeferredInstance } from "./deferred-instance";
import { Defer } from "./defer-context";
import type { Context } from "../context";
import { isContext } from "../context";
import type { Component, VNode } from "../jsx";
import { ComponentInstance } from "./component-instance";

export function createInstance<T extends Context | Component>(
  childId: string,
  vnode: VNode<T>,
  parentCtx: ContextMap,
  index: number,
  parent: BaseInstance | null,
  rctx: RenderContext,
  parentDom: Node,
): BaseInstance<T> {
  if (vnode.type === Defer) {
    return new DeferredInstance(
      childId,
      vnode as any,
      parentCtx,
      index,
      parent,
      rctx,
      parentDom,
    ) as any;
  }
  if (isContext(vnode.type)) {
    return new ContextInstance(
      childId,
      vnode as any,
      parentCtx,
      index,
      parent,
      rctx,
      parentDom,
    ) as any;
  }

  return new ComponentInstance(
    childId,
    vnode as any,
    parentCtx,
    index,
    parent,
    rctx,
    parentDom,
  ) as any;
}
