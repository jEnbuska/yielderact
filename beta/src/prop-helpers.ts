import type { VNodeProps } from "./jsx";

/** Shallow equality check for two objects (same keys, all values `Object.is`). */
export function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const k of aKeys) {
    if (!(k in b) || !Object.is(a[k], b[k])) return false;
  }
  return true;
}

/**
 * Merge a VNode's positional children into its props as `children`,
 * stripping framework directives (`key`, `shown`) that are consumed
 * by the reconciler and should never reach component/context instances.
 */
export function propsWithChildren(props: VNodeProps): VNodeProps {
  const { key: _k, shown: _s, deps: _d, ...rest } = props;
  let children = props.children;
  if (Array.isArray(children)) {
    if (children.length === 1) {
      children = children[0];
    } else if (children.length === 0) {
      children = undefined;
    }
  }
  return { ...rest, children };
}
