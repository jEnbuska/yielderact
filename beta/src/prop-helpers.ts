import type { VNode, VNodeProps } from "./jsx";

/** Shallow equality check for two props objects (same keys, all values `Object.is`). */
export function shallowEqual(a: VNodeProps, b: VNodeProps): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) => Object.is(a[k], b[k]));
}

/**
 * Merge a VNode's positional children into its props as `$children`.
 * Returns the original props object if there are no children (no allocation).
 */
export function propsWithChildren(vnode: VNode): VNodeProps {
  if (vnode.children.length === 0) return vnode.props;
  return { ...vnode.props, $children: vnode.children };
}
