import type { Child, Children, Component, FrameworkProps, PropsWithChildren } from "./jsx";
import { Fragment } from "./jsx";
import type { Context, ContextProps } from "./context";
import type { Draft } from "./slots/draft";
import { asComponentDraft, asContextDraft, asElementDraft, asFragmentDraft } from "./slots/draft";
import { getIntentChildren } from "./slots/intent";

export { Fragment };

export function jsx<P extends Record<string, any>>(
  node: Component<Omit<P, keyof FrameworkProps>>,
  props: (P & FrameworkProps) | null,
  key?: string,
): Draft | null;
export function jsx<T>(node: Context<T>, props: FrameworkProps & ContextProps<T>): Draft | null;

export function jsx(
  node: typeof Fragment,
  props: (Omit<FrameworkProps, "deps"> & { children?: Children }) | null,
  key?: string,
): Draft | null;
export function jsx<T extends keyof JSX.IntrinsicElements>(
  node: T,
  props: (Omit<FrameworkProps, "deps"> & JSX.IntrinsicElements[T] & { children?: Children }) | null,
  key?: string,
): Draft | null;
export function jsx(node: any, props: any, key?: string): Draft | null {
  switch (typeof node) {
    case "function": {
      return asComponentDraft(props.key ?? key, node, props);
    }
    case "string": {
      return asElementDraft(props.key ?? key, node, props, getIntentChildren(props.children));
    }
    case "symbol": {
      return asFragmentDraft(props.key ?? key, getIntentChildren(props.children));
    }
    case "object": {
      return asContextDraft(props.key ?? key, node, props);
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
): Draft | null;
export function jsxs<T>(type: Context<T>, props: FrameworkProps & ContextProps<T>): Draft;
export function jsxs<T extends keyof JSX.IntrinsicElements>(
  type: T,
  props: Omit<FrameworkProps, "deps"> & JSX.IntrinsicElements[T] & PropsWithChildren,
  key?: string,
): Draft | null;
export function jsxs(
  type: typeof Fragment,
  props: Omit<FrameworkProps, "deps"> & PropsWithChildren,
  key?: string,
): Draft | null;
export function jsxs(node: any, props: any, key?: string): Child {
  key = props.key ?? key;
  switch (typeof node) {
    case "function": {
      return asComponentDraft(key, node, props);
    }
    case "string": {
      return asElementDraft(key, node, props, props.children);
    }
    case "symbol": {
      return asFragmentDraft(key, props.children);
    }
    case "object": {
      return asContextDraft(key, node, props);
    }
    default: {
      throw new Error(`Invalid JSX node type "${typeof node}"`);
    }
  }
}

export const jsxDEV = (node: any, props: any, key: string | undefined, staticChildren: boolean) => {
  if (staticChildren) return jsxs(node, props, key);
  return jsx(node, props, key);
};
