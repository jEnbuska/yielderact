/**
 * JSX automatic runtime – used when `jsxImportSource` is set to `"yract"`.
 *
 * With this runtime you can write JSX without an explicit import of
 * `createElement` in every file. Instead, add to your tsconfig / babel config:
 *
 *   { "jsxImportSource": "yract" }
 *
 * or at the top of a file:
 *
 *   /\*\* \@jsxImportSource yract \*\/
 */
import { type Child, createElement, Fragment, Portal, type VNode } from "./jsx";

export { Fragment, Portal };

/** Used by the JSX transform for single-child expressions. */
export function jsx(
  type: VNode["type"],
  props: { children?: Child | Child[] } & Record<string, unknown>,
  key?: string | number | null,
): VNode {
  const { children, ...rest } = props;
  // The automatic JSX transform extracts `key` and passes it as the third
  // argument. Map it to `key` (string only) for our reconciler.
  if (key != null) rest["key"] = String(key);
  if (children === undefined) {
    return createElement(type, rest);
  }
  if (Array.isArray(children)) {
    return createElement(type, rest, ...children);
  }
  return createElement(type, rest, children as Child);
}

/** Used by the JSX transform for multi-child expressions (static children). */
export const jsxs = jsx;

/** Used by the JSX transform in development mode. */
export const jsxDEV = jsx;
