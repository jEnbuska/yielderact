import type { Children, Component, PropsWithChildren } from "./jsx";
import { Fragment } from "./jsx";
import { randomId } from "./general";
import { jsx } from "./jsx-runtime";
import type { ContextMap } from "./render/types";

export interface ContextProps<T = unknown> extends PropsWithChildren {
  key?: string;
  shown?: boolean;
  value: T;
  children: Children;
}

export type Context<T = any> = ContextProperties<T> & {
  (props: ContextProps<T>): never;
};

export type ContextProperties<T> = {
  ref: { current: T };
  subscribe: (cb: () => void) => () => void;
  depth: number;
  id: string;
  Provider: Component;
};

export function createContext<T>(defaultValue: T): Context<T> {
  const Provider: Context<T>["Provider"] = function* ContextProvider({ children }) {
    return jsx(Fragment, { children: children as Children });
  };
  return {
    ref: { current: defaultValue },
    subscribe: () => () => {},
    depth: -1,
    id: randomId(),
    Provider,
  } satisfies ContextProperties<T> as any;
}

export function resolveContext<T>(map: ContextMap | undefined, ctx: Context<T>): T {
  const handle = map?.get(ctx.id);
  return (handle?.ref.current as T) ?? ctx.ref.current;
}
