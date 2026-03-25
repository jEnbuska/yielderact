import { type Context, PriorityContext, resolveCtx, withBatch, withPriority } from "../context";
import type { Renderable } from "../hooks";
import {
  type Child,
  type Component,
  Fragment,
  type InternalProps,
  type SpecialProps,
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

/**
 * Returns true when `a` and `b` differ only in the `$patch` prop.
 *
 * Enables skipping a rerender when only `$patch` changed -- the value is
 * forwarded for `shouldDefer` checks without re-executing the generator.
 */
export function onlyPatchChanged(a: InternalProps, b: InternalProps): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  let patchDiffers = false;
  for (const k of aKeys) {
    if (Object.is(a[k], b[k])) continue;
    if (k === "$patch") {
      patchDiffers = true;
      continue;
    }
    return false; // content prop differs
  }
  return patchDiffers;
}

/** Recursively flatten Fragment VNodes into a flat list of non-Fragment children. */
export function flattenChildren(children: Child[]): Child[] {
  const result: Child[] = [];
  for (const child of children) {
    if (isVNode(child) && child.type === Fragment) {
      result.push(...flattenChildren(child.children));
    } else {
      result.push(child);
    }
  }
  return result;
}

/**
 * Compute the merged props for a VNode, including `children` if present.
 *
 * When a VNode has children (e.g. `<Comp>child</Comp>`), they are passed
 * to the component as `props.children`.
 */
export function mergedProps(vnode: VNode): InternalProps {
  return (
    vnode.children.length > 0 ? { ...vnode.props, children: vnode.children } : vnode.props
  ) satisfies InternalProps;
}

/**
 * Build a child context map from a parent map, applying `$patch` and
 * `$deferred` from the given props.
 *
 * Returns the parent map unchanged if neither directive is set.
 */
export function childContextMap(
  parentMap: ReadonlyMap<Context<unknown>, unknown>,
  props: SpecialProps,
): ReadonlyMap<Context<unknown>, unknown> {
  let map = parentMap;
  const batch = props.$patch;
  if (batch !== undefined) map = withBatch(map, batch);
  if (props.$deferred) map = withPriority(map, resolveCtx(map, PriorityContext) + 1);
  return map;
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
  const { $deferred: _, ...rest } = props;
  return rest satisfies InternalProps;
}
