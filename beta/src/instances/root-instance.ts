/**
 * RootInstance — synthetic parent for top-level slots under a createRoot().
 *
 * It is a real BaseInstance so the reconciler can uniformly access `ctx`
 * and `rctx` through `parentInstance`, and so unmount cascades via
 * `this.children` also tear down the whole tree. Its `doRender()` is a
 * no-op: the root is driven by `Root.render(vnode)` which calls
 * `reconcileChildren` directly.
 */
import { Fragment, type VNode } from "../jsx";
import type { RenderContext } from "../render/types";
import { BaseInstance } from "./base-instance";

const ROOT_VNODE: VNode = { type: Fragment, props: {}, children: [] };

export class RootInstance extends BaseInstance {
  constructor(rctx: RenderContext) {
    super(ROOT_VNODE, new Map(), 0, null, rctx);
  }

  protected doRender(): void {
    // Root is updated via Root.render(), not by the scheduler.
  }

  debugLabel(): string {
    return "<Root>";
  }
}
