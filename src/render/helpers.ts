import type { Renderable } from "../hooks";
import {
  type Child,
  type Component,
  Fragment,
  type InternalProps,
  type SpecialProps,
  type VNode,
} from "../jsx";

/**
 * Type guard: returns `true` when `child` is a VNode (an object with a `type` field).
 *
 * Narrows the `Child` union (`VNode | string | number | boolean | null | undefined`)
 * to `VNode`, eliminating the need for `as VNode` casts after the check.
 *
 * **Called by:** `flattenChildren` (to detect Fragment wrappers), and the
 * reconciler (to narrow children before type-specific handling).
 */
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

/**
 * Shallow equality check for two props objects.
 *
 * Returns `true` when both objects have the same keys and every value
 * is identical by `Object.is`. Used as the primary memoization gate
 * in the reconciler — when props haven't changed, the component is skipped.
 *
 * **Called by:** `reconcileOne` in `reconciler.ts` — to determine if a
 * same-type component at the same position can be skipped (no rerender).
 *
 * @param a - Previous props (from `Slot.props`).
 * @param b - Next props (from the new VNode).
 */
export function shallowEqual(a: InternalProps, b: InternalProps): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) => Object.is(a[k], b[k]));
}

/**
 * Returns true when `a` and `b` differ **only** in the `$patch` prop and
 * all other (content) props are identical.
 *
 * This enables an optimization: when a parent changes only a child's
 * `$patch` prop, the child's generator body doesn't need to re-execute.
 * The `$patch` value is forwarded to `inst.props` for `shouldDefer`
 * checks, but no rerender occurs — unless the component consumes
 * `usePatchContext` (detected separately via `_batchCtx`).
 *
 * **Called by:** `reconcileOne` in `reconciler.ts` — after `shallowEqual`
 * returns `false`, as a secondary check before falling through to a full
 * rerender.
 *
 * @param a - Previous props (from `Slot.props`).
 * @param b - Next props (from the new VNode).
 * @returns `true` if and only if `$patch` differs and all other props match.
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

/**
 * Recursively flatten Fragment VNodes into a flat list of non-Fragment children.
 *
 * Fragments (`<>…</>`) are virtual grouping nodes that produce no DOM element.
 * Before reconciling, fragments must be flattened so each child has a stable
 * positional index in the parent's slot array.
 *
 * **Called by:** `reconcileSlots` in `reconciler.ts` — as the first step
 * before the positional reconciliation loop.
 *
 * @param children - The raw children array (may contain nested Fragments).
 * @returns A flat array with all Fragment wrappers removed.
 */
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
 * to the component as `props.children`. This function merges them into a
 * single props object so the component receives `{ ...ownProps, children }`.
 *
 * **Called by:**
 * - `reconcileOne` in `reconciler.ts` — to compute the full props before
 *   checking `$shown`, `shallowEqual`, and passing to components.
 * - `buildVNodeList` and `buildNode` in `mount.ts` — same purpose during
 *   initial mount.
 *
 * @param vnode - The VNode whose props to merge.
 * @returns The props object, with `children` included if non-empty.
 */
export function mergedProps(vnode: VNode): InternalProps {
  return (
    vnode.children.length > 0 ? { ...vnode.props, children: vnode.children } : vnode.props
  ) as InternalProps;
}

/**
 * Read the `$patch` mode from a props object.
 *
 * Returns `'live'`, `'default'`, or `undefined` (when not set).
 * **Called by:** reconciler and mount — whenever the effective batch behaviour
 * needs to be determined from a VNode's props.
 */
export function getPatchMode(props: SpecialProps): SpecialProps["$patch"] {
  return props.$patch;
}

/**
 * Returns false only when the `$shown` prop is explicitly set to `false`.
 *
 * The `$shown` prop controls conditional mount/unmount. When `$shown={false}`,
 * the component or element is replaced with an empty text node placeholder.
 *
 * **Called by:**
 * - `reconcileOne` in `reconciler.ts` — before processing any VNode.
 * - `buildVNodeList` and `buildNode` in `mount.ts` — during initial mount.
 *
 * @param props - The (merged) props to check.
 */
export function isShown(props: SpecialProps): boolean {
  return props.$shown !== false;
}

/**
 * Strip `$deferred` from a props object, returning props without it.
 *
 * `$deferred` is a framework-level directive that controls priority
 * scheduling. It is **not** passed to the component — the component
 * should never see it in its props.
 *
 * If `$deferred` is not present, returns the original object (no allocation).
 *
 * **Called by:**
 * - `reconcileOneGen` in `reconciler.ts` — before passing props to components.
 * - `buildNode` / `buildVNodeList` in `mount.ts` — same.
 *
 * @param props - The (merged) props that may contain `$deferred`.
 * @returns Props without `$deferred`.
 */
export function stripDeferred(props: InternalProps): InternalProps {
  if (!("$deferred" in props)) return props;
  const { $deferred: _, ...rest } = props;
  return rest as InternalProps;
}
