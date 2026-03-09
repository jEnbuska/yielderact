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
  props: { children?: Child; $children?: Child | Child[] } & Record<string, unknown>,
  key?: string | number | null,
): VNode {
  // Extract children from both the transform (`children`) and explicit
  // `$children` prop. `$children` takes priority when both are present.
  const { children, $children, ...rest } = props;
  // The automatic JSX transform extracts `key` and passes it as the third
  // argument. Map it to `$key` (string only) for our reconciler.
  if (key != null) rest.$key = String(key);
  const effectiveChildren = $children ?? children;
  if (effectiveChildren === undefined) {
    return createElement(type, rest);
  }
  if (Array.isArray(effectiveChildren)) {
    return createElement(type, rest, ...effectiveChildren);
  }
  return createElement(type, rest, effectiveChildren as Child);
}

/** Used by the JSX transform for multi-child expressions (static children). */
export const jsxs = jsx;

/** Used by the JSX transform in development mode. */
export const jsxDEV = jsx;
