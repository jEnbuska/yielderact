/**
 * Public render entry points.
 *
 * `createRoot(container)` wires up one Scheduler + one DelegationRoot for
 * the container, returns a `Root` handle, and lets the caller mount/unmount
 * VNodes into it. `render(vnode, container)` is a one-shot convenience
 * wrapper that creates a Root, mounts `vnode`, and returns the Root.
 */

import type { VNode } from "../jsx";
import { Root } from "./root";

export function createRoot(container: Element): Root {
  return new Root(container);
}

export function render(vnode: VNode, container: Element): Root {
  const root = new Root(container);
  root.render(vnode);
  return root;
}
