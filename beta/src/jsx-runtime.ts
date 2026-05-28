import type { Child, Children, Component, FrameworkProps, PropsWithChildren } from "./jsx";
import { Fragment } from "./jsx";
import type { Context, ContextProps } from "./context";
import type { DraftIntent } from "./slots/intent-draft";
import { getIntentChildren } from "./slots/slot-intent";
import type { DependencyList } from "./general-types";
import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlotType,
  FragmentSlotType,
} from "./slots/slot";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  fragmentSlotType,
} from "./slots/slot";

export { Fragment };

export function jsx<P extends Record<string, any>>(
  node: Component<Omit<P, keyof FrameworkProps>>,
  props: (P & FrameworkProps) | null,
  key?: string,
): DraftIntent | null;
export function jsx<T>(
  node: Context<T>,
  props: FrameworkProps & ContextProps<T>,
): DraftIntent | null;

export function jsx(
  node: typeof Fragment,
  props: (Omit<FrameworkProps, "deps"> & { children?: Children }) | null,
  key?: string,
): DraftIntent | null;
export function jsx<T extends keyof JSX.IntrinsicElements>(
  node: T,
  props: (Omit<FrameworkProps, "deps"> & JSX.IntrinsicElements[T] & { children?: Children }) | null,
  key?: string,
): DraftIntent | null;
export function jsx(node: any, props: any, _key?: string): DraftIntent | null {
  const { key = _key, shown, deps, children, ...rest } = props;
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
      return asContextDraft(children, key, node, props);
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

export function asFragmentDraft(
  children: Children[],
  key: string | undefined,
): DraftIntent<FragmentSlotType> {
  return {
    children: getIntentChildren(children),
    component: undefined,
    context: undefined,
    deps: undefined,
    element: undefined,
    headNode: undefined,
    index: undefined,
    instance: undefined,
    key,
    move: undefined,
    path: undefined,
    prevProps: undefined,
    prevText: undefined,
    props: undefined,
    slots: undefined,
    tailNode: undefined,
    text: undefined,
    type: fragmentSlotType,
  };
}

export function asContextDraft(
  children: Children,
  key: string | undefined,
  context: Context,
  props: Record<string, unknown>,
): DraftIntent<ContextSlotType> {
  return {
    children: getIntentChildren(children),
    component: context.Provider,
    context,
    deps: undefined,
    element: undefined,
    headNode: undefined,
    index: undefined,
    instance: undefined,
    key,
    move: undefined,
    path: undefined,
    prevProps: undefined,
    prevText: undefined,
    props,
    slots: undefined,
    tailNode: undefined,
    text: undefined,
    type: contextSlotType,
  };
}

export function asElementDraft(
  children: Children,
  key: string | undefined,
  element: string,
  props: Record<string, unknown>,
): DraftIntent<ElementSlotType> {
  return {
    children: getIntentChildren(children),
    component: undefined,
    context: undefined,
    deps: undefined,
    element,
    headNode: undefined,
    index: undefined,
    instance: undefined,
    key,
    move: undefined,
    path: undefined,
    prevProps: undefined,
    prevText: undefined,
    props,
    slots: undefined,
    tailNode: undefined,
    text: undefined,
    type: elementSlotType,
  };
}

function asComponentDraft(
  children: Children,
  key: string | undefined,
  component: Component,
  props: Record<string, unknown>,
  deps: DependencyList | undefined,
): DraftIntent<ComponentSlotType> {
  return {
    children: getIntentChildren(children),
    component,
    context: undefined,
    deps,
    element: undefined,
    headNode: undefined,
    index: undefined,
    instance: undefined,
    key,
    move: undefined,
    path: undefined,
    prevProps: undefined,
    prevText: undefined,
    props,
    slots: undefined,
    tailNode: undefined,
    text: undefined,
    type: componentSlotType,
  };
}
