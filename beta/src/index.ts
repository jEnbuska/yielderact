// Public API for yract-beta.

export { type Context, type ContextProps, createContext, resolveContext } from "./context";

export type { SEvent, SyntheticEvent } from "./events";
export {
  useContext,
  useEffect,
  $id,
  useMemo,
  useRef,
  useStable,
  useState,
  useDefer,
  type RefObject,
  $load,
  $halted,
  $halt,
  getForceUpdate,
} from "./hooks";
export {
  type Child,
  type Children,
  type Component,
  type ComponentProps,
  Fragment,
  type FrameworkProps,
  type PropsWithChildren,
} from "./jsx";

export { createRoot, render } from "./render";
export { Root } from "./render/root";

export type { ComponentGenerator } from "./general-types";
export type { DependencyList } from "./general-types";
