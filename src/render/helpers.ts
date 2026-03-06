import {
  type AnyComponentFn,
  type GeneratorComponentFn,
  type VNode,
  type Child,
  Fragment,
} from '../jsx';

/** Returns true when `fn` is a generator function (i.e. uses `function*`). */
export function isGeneratorFn(fn: AnyComponentFn): fn is GeneratorComponentFn {
  return fn.constructor.name === 'GeneratorFunction';
}

/** Remove all child nodes from a DOM element. */
export function clearChildren(node: Node): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

/** Shallow equality check for props objects. */
export function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) => Object.is(a[k], b[k]));
}

/** Flatten Fragment VNodes into a flat list of non-Fragment children. */
export function flattenChildren(children: Child[]): Child[] {
  const result: Child[] = [];
  for (const child of children) {
    if (child != null && typeof child === 'object' && (child as VNode).type === Fragment) {
      result.push(...flattenChildren((child as VNode).children));
    } else {
      result.push(child);
    }
  }
  return result;
}

/** Compute the merged props for a VNode (includes children if any). */
export function mergedProps(vnode: VNode): Record<string, unknown> {
  return vnode.children.length > 0 ? { ...vnode.props, children: vnode.children } : vnode.props;
}

/** Returns false only when the `$shown` prop is explicitly set to `false`. */
export function isShown(props: Record<string, unknown>): boolean {
  return props['$shown'] !== false;
}
