// Public API for yract-beta.

export {
  type Context,
  type ContextHandle,
  type ContextProviderProps,
  createContext,
  resolveCtxValue,
} from "./context";

export type { SEvent, SyntheticEvent } from "./events";
export {
  $context,
  $effect,
  $id,
  $memo,
  $ref,
  $stable,
  $state,
  type ComponentGenerator,
  type DependencyList,
  type RefObject,
} from "./hooks";
export { Defer } from "./instances/defer-context";
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
