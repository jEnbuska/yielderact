import type { Children, Component, FrameworkProps, PropsWithChildren, VNodeProps } from "./jsx";
import { Fragment, type VNode } from "./jsx";
import type { Context, ContextProviderProps } from "./context";

export { Fragment };

const emptyChildren: Children[] = [];
const defaultProps: VNodeProps = Object.freeze({ children: emptyChildren });
export function jsx<P extends Record<string, any>>(
  type: Component<Omit<P, keyof FrameworkProps>>,
  props: (P & FrameworkProps) | null,
): VNode;
export function jsx<T>(type: Context<T>, props: FrameworkProps & ContextProviderProps<T>): VNode;
export function jsx<T extends keyof JSX.IntrinsicElements>(
  type: T,
  props: (Omit<FrameworkProps, "deps"> & JSX.IntrinsicElements[T] & PropsWithChildren) | null,
): VNode;
export function jsx(
  type: typeof Fragment,
  props: (Omit<FrameworkProps, "deps"> & PropsWithChildren) | null,
): VNode;
export function jsx(type: any, props: any, key?: string): VNode {
  if (props == null) {
    return { type, props: key === undefined ? defaultProps : { ...defaultProps, key } };
  }
  if (key !== undefined) {
    return { type, props: { ...props, key } };
  }
  return { type, props };
}

export function jsxs<P extends Record<string, any>>(
  type: Component<Omit<P, keyof FrameworkProps>>,
  props: P & FrameworkProps,
): VNode;
export function jsxs<T>(type: Context<T>, props: FrameworkProps & ContextProviderProps<T>): VNode;
export function jsxs<T extends keyof JSX.IntrinsicElements>(
  type: T,
  props: Omit<FrameworkProps, "deps"> & JSX.IntrinsicElements[T] & PropsWithChildren,
): VNode;
export function jsxs(
  type: typeof Fragment,
  props: Omit<FrameworkProps, "deps"> & PropsWithChildren,
): VNode;
export function jsxs(type: any, props: any, key?: string): VNode {
  if (key !== undefined) {
    return { type, props: { ...props, key } };
  }
  return { type, props };
}

export const jsxDEV = jsx;
