import type {
  Child,
  Children,
  Component,
  FrameworkProps,
  PropsWithChildren,
  VNodeProps,
} from "./jsx";
import { Fragment } from "./jsx";
import type { Context, ContextProps } from "./context";
import type { DraftIntent } from "./slots/intent-draft";
import {
  asComponentDraft,
  asContextDraft,
  asElementDraft,
  asFragmentDraft,
} from "./slots/intent-draft";

export { Fragment };

const emptyChildren: Children[] = [];
const defaultProps: VNodeProps = Object.freeze({ children: emptyChildren });
export function jsx<P extends Record<string, any>>(
  node: Component<Omit<P, keyof FrameworkProps>>,
  props: (P & FrameworkProps) | null,
  key?: string,
): DraftIntent | null;
export function jsx<T>(
  node: Context<T>,
  props: FrameworkProps & ContextProps<T>,
): DraftIntent | null;
export function jsx<T extends keyof JSX.IntrinsicElements>(
  node: T,
  props: (Omit<FrameworkProps, "deps"> & JSX.IntrinsicElements[T] & PropsWithChildren) | null,
  key?: string,
): DraftIntent | null;
export function jsx(
  node: typeof Fragment,
  props: (Omit<FrameworkProps, "deps"> & PropsWithChildren) | null,
  key?: string,
): DraftIntent | null;
export function jsx(node: any, props: any, key?: string): DraftIntent | null {
  const { key: propsKey, shown, deps, children, ...rest } = props ?? defaultProps;
  key ??= propsKey;
  if (shown === false) return null;
  switch (typeof node) {
    case "function": {
      return asComponentDraft(children, key, node, rest, deps);
    }
    case "string": {
      return asElementDraft(children, key, node, rest);
    }
    case "symbol": {
      return asFragmentDraft(children, key);
    }
    case "object": {
      return asContextDraft(children, key, node, props?.value);
    }
    default: {
      throw new Error(`Invalid JSX node type "${typeof node}"`);
    }
  }
}

export function jsxs<P extends Record<string, any>>(
  type: Component<Omit<P, keyof FrameworkProps>>,
  props: P & FrameworkProps,
  key?: string,
): DraftIntent | null;
export function jsxs<T>(type: Context<T>, props: FrameworkProps & ContextProps<T>): DraftIntent;
export function jsxs<T extends keyof JSX.IntrinsicElements>(
  type: T,
  props: Omit<FrameworkProps, "deps"> & JSX.IntrinsicElements[T] & PropsWithChildren,
  key?: string,
): DraftIntent | null;
export function jsxs(
  type: typeof Fragment,
  props: Omit<FrameworkProps, "deps"> & PropsWithChildren,
  key?: string,
): DraftIntent | null;
export function jsxs(node: any, props: any, key?: string): Child {
  // TODO
  return jsx(node, props, key);
}

export const jsxDEV = jsx;
