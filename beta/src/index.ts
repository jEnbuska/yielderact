// Public API for yract-beta.

export { type Context, type ContextProps, createContext, resolveContext } from "./context";

export type { SEvent, SyntheticEvent } from "./events";
export {
  $context,
  $effect,
  $id,
  $memo,
  $ref,
  $stable,
  $state,
  $defer,
  type RefObject,
} from "./hooks";
export {
  type Children,
  type Component,
  type ComponentProps,
  Fragment,
  type FrameworkProps,
  type PropsWithChildren,
  type VNode,
  type VNodeProps,
  type VNodeType,
} from "./jsx";

export { createRoot, render } from "./render";
export { Root } from "./render/root";

export type { ComponentGenerator } from "./general-types";
export type { DependencyList } from "./general-types";
