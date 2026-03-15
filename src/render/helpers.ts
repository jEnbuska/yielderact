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
 * Shallow equality check excluding the `children` key.
 *
 * Used as the primary memoization gate in the children-only reconciliation
 * optimization. When all non-children props are unchanged, the component
 * generator can be skipped and only the children subtree is reconciled.
 *
 * @param a - Previous props (from `Slot.props`).
 * @param b - Next props (from the new VNode).
 */
export function shallowEqualExcludingChildren(a: InternalProps, b: InternalProps): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  let aCount = 0;
  let bCount = 0;
  for (const k of aKeys) if (k !== "children") aCount++;
  for (const k of bKeys) if (k !== "children") bCount++;
  if (aCount !== bCount) return false;
  for (const k of aKeys) {
    if (k === "children") continue;
    if (!Object.is(a[k], b[k])) return false;
  }
  return true;
}

/**
 * Returns true when `a` and `b` differ **only** in the `$patch` prop
 * (and possibly `children`) and all other content props are identical.
 *
 * Like `onlyPatchChanged` but also skips the `children` key.
 *
 * @param a - Previous props.
 * @param b - Next props.
 */
export function onlyPatchChangedExcludingChildren(a: InternalProps, b: InternalProps): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  let aCount = 0;
  let bCount = 0;
  for (const k of aKeys) if (k !== "children") aCount++;
  for (const k of bKeys) if (k !== "children") bCount++;
  if (aCount !== bCount) return false;
  let patchDiffers = false;
  for (const k of aKeys) {
    if (k === "children") continue;
    if (Object.is(a[k], b[k])) continue;
    if (k === "$patch") {
      patchDiffers = true;
      continue;
    }
    return false;
  }
  return patchDiffers;
}

/**
 * Compare two `children` arrays element-wise via `Object.is`.
 *
 * Returns `true` when the arrays have the same length and every element
 * is identical. `undefined` is treated as an empty array.
 */
export function childrenShallowEqual(a: Child[] | undefined, b: Child[] | undefined): boolean {
  const aLen = a?.length ?? 0;
  const bLen = b?.length ?? 0;
  if (aLen !== bLen) return false;
  if (aLen === 0) return true;
  for (let i = 0; i < aLen; i++) {
    if (!Object.is((a as Child[])[i], (b as Child[])[i])) return false;
  }
  return true;
}

/**
 * Walk an output VNode tree to find where `passedChildren` appear as a
 * contiguous run of children (matched by reference, VNode objects only).
 *
 * Returns `{ path, startIdx, count }` or `null` if no contiguous match
 * is found. Only VNode objects are matched by reference — primitives are
 * skipped to avoid ambiguity.
 *
 * @param vnode - The output VNode tree to search.
 * @param passedChildren - The children array from props.
 * @param path - Current path (array of child indices) for recursion.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: VNode tree walk with contiguous reference matching
export function findChildrenPosition(
  vnode: VNode,
  passedChildren: Child[],
  path: number[],
): { path: number[]; startIdx: number; count: number } | null {
  // Filter to only VNode references for matching (skip primitives)
  const vnodeRefs = passedChildren.filter(isVNode);
  if (vnodeRefs.length === 0) return null;

  const children = vnode.children;
  // Try to find a contiguous run of vnodeRefs in this node's children
  const firstRef = vnodeRefs[0] as VNode;
  for (let startIdx = 0; startIdx < children.length; startIdx++) {
    if (children[startIdx] === firstRef) {
      // Check if all vnodeRefs appear contiguously starting here
      let matched = true;
      let childIdx = startIdx;
      let refIdx = 0;
      while (refIdx < vnodeRefs.length && childIdx < children.length) {
        const child = children[childIdx];
        if (isVNode(child)) {
          if (child !== vnodeRefs[refIdx]) {
            matched = false;
            break;
          }
          refIdx++;
        }
        childIdx++;
      }
      if (matched && refIdx === vnodeRefs.length) {
        return { path, startIdx, count: childIdx - startIdx };
      }
    }
  }

  // Recurse into VNode children
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (isVNode(child) && child.children.length > 0) {
      const result = findChildrenPosition(child, passedChildren, [...path, i]);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Navigate the stored VNode tree via `path`, shallow-clone nodes on the
 * path, and splice `newChildren` at the tracked position.
 *
 * Only O(path.length) clones are made — the rest of the tree is shared.
 *
 * @param vnode - The stored output VNode.
 * @param position - The tracked children position.
 * @param newChildren - The new children to splice in.
 */
export function patchOutputVNode(
  vnode: VNode,
  position: { path: number[]; startIdx: number; count: number },
  newChildren: Child[],
): VNode {
  if (position.path.length === 0) {
    // Replace at this level
    const newChildArray = [...vnode.children];
    newChildArray.splice(position.startIdx, position.count, ...newChildren);
    return { type: vnode.type, props: vnode.props, children: newChildArray };
  }

  // Navigate deeper: clone this node and the child at path[0]
  const idx = position.path[0] as number;
  const newChildArray = [...vnode.children];
  const childAtIdx = newChildArray[idx];
  if (!isVNode(childAtIdx)) return vnode; // safety
  newChildArray[idx] = patchOutputVNode(
    childAtIdx,
    {
      path: position.path.slice(1),
      startIdx: position.startIdx,
      count: position.count,
    },
    newChildren,
  );
  return { type: vnode.type, props: vnode.props, children: newChildArray };
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
 * Strip framework-level directives (`$deferred`, `$deps`) from a props
 * object, returning props without them.
 *
 * These directives are consumed by the reconciler/scheduler and are
 * **not** passed to the component — the component should never see them
 * in its props.
 *
 * If neither directive is present, returns the original object (no allocation).
 *
 * **Called by:**
 * - `reconcileComponent` in `reconciler.ts` — before passing props to components.
 * - `buildNode` / `buildVNodeList` in `mount.ts` — same.
 *
 * @param props - The (merged) props that may contain `$deferred` / `$deps`.
 * @returns Props without `$deferred` or `$deps`.
 */
export function stripFrameworkDirectives(props: InternalProps): InternalProps {
  if (!("$deferred" in props) && !("$deps" in props)) return props;
  const { $deferred: _d, $deps: _p, ...rest } = props;
  return rest as InternalProps;
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
  return rest as InternalProps;
}
