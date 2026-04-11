/**
 * JSX automatic runtime — used when `jsxImportSource: "yract-beta"`.
 *
 * TypeScript's automatic JSX runtime hardcodes `children` as the prop name
 * it packs JSX children under (this is not configurable via
 * `JSX.ElementChildrenAttribute` for components). We accept that
 * convention here, destructure `children` out, and forward it as positional
 * rest args to `createElement`, which then re-keys it as `$children` on
 * the vnode props (the framework convention). We also re-key the
 * transform's `key` argument to `$key`.
 *
 * The `children` ↔ `$children` bridge at the type-checking layer is
 * handled by `JSX.LibraryManagedAttributes` in `jsx.ts`, which exposes a
 * component's `$children` prop as `children` to JSX validation.
 */
import { type Child, createElement, Fragment, type VNode } from "./jsx";

export { Fragment };

export function jsx(
  type: VNode["type"],
  props: { children?: Child | Child[] } & Record<string, unknown>,
  key?: string | number | null,
): VNode {
  const { children, ...rest } = props;
  if (key != null) rest["$key"] = String(key);
  if (children === undefined) {
    return createElement(type, rest);
  }
  if (Array.isArray(children)) {
    return createElement(type, rest, ...children);
  }
  return createElement(type, rest, children);
}

export const jsxs = jsx;
export const jsxDEV = jsx;
