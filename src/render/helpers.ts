import type { Renderable } from "../hooks";
import {
  type Child,
  type Component,
  type InternalProps,
  RawFragment,
  type VNode,
} from "../jsx";

/** Type guard: narrows `Child` to `VNode`. */
export function isVNode(child: Child): child is VNode {
  return child !== null && child !== undefined && typeof child === "object";
}

/** Narrows a VNode to a component node (`VNode<Component>`). */
export function isComponentNode(vnode: VNode): vnode is VNode<Component> {
  return typeof vnode.type === "function";
}

/** Checks if a VNode is a context provider. */
export function isContextProvider(vnode: VNode): boolean {
  return typeof vnode.type === "function" && (vnode.type as { provider?: boolean }).provider === true;
}

/** Narrows a VNode to an HTML element node (`VNode<string>`). */
export function isElementNode(vnode: VNode): vnode is VNode<string> {
  return typeof vnode.type === "string";
}

/** Narrow Renderable type down to Component  */
export function isComponentRenderable(renderable: Renderable): renderable is Component {
  return typeof renderable === "function";
}

/** Shallow equality check for two props objects (same keys, all values `Object.is`). */
export function shallowEqual(a: InternalProps, b: InternalProps): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) => Object.is(a[k], b[k]));
}

/** Recursively flatten RawFragment VNodes into a flat list of non-fragment children. */
export function flattenChildren(children: Child[]): Child[] {
  const result: Child[] = [];
  for (const child of children) {
    if (isVNode(child) && child.type === RawFragment) {
      result.push(...flattenChildren(child.children));
    } else {
      result.push(child);
    }
  }
  return result;
}

/**
 * Return props with `children` included when the VNode has children.
 *
 * When a VNode has children (e.g. `<Comp>child</Comp>`), they are added
 * to the props object as `props.children` so the component can access them.
 */
export function propsWithChildren(vnode: VNode): InternalProps {
  return (
    vnode.children.length > 0 ? { ...vnode.props, children: vnode.children } : vnode.props
  ) satisfies InternalProps;
}

/**
 * Strip framework-level directives (`$deferred`, `$deps`) from a props
 * object, returning props without them.
 *
 * These directives are consumed by the reconciler/scheduler and are
 * not passed to the component. Returns the original object if neither
 * directive is present (no allocation).
 */
export function stripFrameworkDirectives(props: InternalProps): InternalProps {
  if (!("$deferred" in props) && !("$deps" in props)) return props;
  const { $deferred: _d, $deps: _p, ...rest } = props;
  return rest satisfies InternalProps;
}

/**
 * Strip `$deferred` from a props object, keeping `$deps` intact.
 *
 * Used to produce the "slot props" stored in `Slot.props` — `$deps`
 * is retained so the reconciler can compare it on the next update,
 * while `$deferred` is propagated via context and not needed on the slot.
 *
 * If `$deferred` is not present, returns the original object (no allocation).
 */
export function stripDeferred(props: InternalProps): InternalProps {
  if (!("$deferred" in props)) return props;
  const { $deferred: _d, ...rest } = props;
  return rest satisfies InternalProps;
}
