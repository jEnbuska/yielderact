/**
 * JSX automatic runtime – used when `jsxImportSource` is set to `"yielderact"`.
 *
 * With this runtime you can write JSX without an explicit import of
 * `createElement` in every file. Instead, add to your tsconfig / babel config:
 *
 *   { "jsxImportSource": "yielderact" }
 *
 * or at the top of a file:
 *
 *   /\*\* \@jsxImportSource yielderact \*\/
 */
import { createElement, Fragment, VNode, Child } from './jsx';

export { Fragment };

/** Used by the JSX transform for single-child expressions. */
export function jsx(
  type: VNode['type'],
  props: { children?: Child } & Record<string, unknown>
): VNode {
  const { children, ...rest } = props;
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
