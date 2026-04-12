import { type Context, type ContextEntry, resolveCtx } from "../context";
import type { Renderable } from "../hooks";
import {
  type Child,
  type Component,
  type InternalProps,
  RawFragment,
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
 * Apply `context` entries to a context map, skipping entries whose value
 * is already the same. Returns the original map if nothing changed.
 */
function withContextEntries(
  map: ReadonlyMap<Context, unknown>,
  ctxProp: ContextEntry | ContextEntry[],
): ReadonlyMap<Context, unknown> {
  const entries = Array.isArray(ctxProp) ? ctxProp : [ctxProp];
  let newMap: Map<Context, unknown> | undefined;
  for (const entry of entries) {
    if (!Object.is(resolveCtx(newMap ?? map, entry.ctx), entry.value)) {
      if (!newMap) newMap = new Map(map);
      newMap.set(entry.ctx, entry.value);
    }
  }
  return newMap ?? map;
}

/**
 * Build a child context map from a parent map, applying framework
 * directives (`context`) from the given props.
 *
 * Returns the parent map unchanged if no directive is set.
 */
export function childContextMap(
  parentMap: ReadonlyMap<Context, unknown>,
  props: SpecialProps,
): ReadonlyMap<Context, unknown> {
  if (props.$context) return withContextEntries(parentMap, props.$context);
  return parentMap;
}

/** Normalize a `context` prop to an array of entries. */
export function contextEntries(ctxProp: ContextEntry | ContextEntry[] | undefined): ContextEntry[] {
  if (!ctxProp) return [];
  return Array.isArray(ctxProp) ? ctxProp : [ctxProp];
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
  if (!("$deferred" in props) && !("$deps" in props) && !("$context" in props)) return props;
  const { $deferred: _d, $deps: _p, $context: _c, ...rest } = props;
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
  if (!("$deferred" in props) && !("$context" in props)) return props;
  const { $deferred: _d, $context: _c, ...rest } = props;
  return rest satisfies InternalProps;
}
