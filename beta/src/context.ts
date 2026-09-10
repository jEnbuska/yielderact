import type { Children, Component } from "./jsx";
import { Fragment } from "./jsx";
import { randomId } from "./general";
import { jsx } from "./jsx-runtime";
import type { ContextMap } from "./render/types";
import type { ComponentGenerator } from "./general-types";
import type { ContextHookState } from "./hooks/context";

export interface ContextProps<T = unknown> {
  key?: string;
  value: T;
  children: Children;
}

export type Context<T = any> = ContextProperties<T> & {
  (props: ContextProps<T>): ComponentGenerator;
};

export type ContextProperties<T> = {
  ref: { current: T };
  version: number;
  name: string;
  subscribe: (state: ContextHookState) => () => void;
  depth: number;
  id: string;
  Provider: Component<ContextProps<T>>;
};

function getDefaultValue<T>(defaultValue: (() => T) | T): T {
  if (defaultValue === "function") {
    return (defaultValue as any)() as T;
  }
  return defaultValue as T;
}

export function createContext<T>(defaultValue: (() => T) | T): Context<T>;
export function createContext<T>(defaultValue: (() => T) | T, name: Capitalize<string>): Context<T>;
export function createContext(...args: any[]): any {
  const [defaultValue, name = ""] = args;
  const providerName = `${name}Provider`;
  const withProvider = {
    *[providerName]({ children }: { children: Children }) {
      return jsx(Fragment, { children });
    },
  };
  return {
    ref: { current: getDefaultValue(defaultValue) },
    subscribe: () => () => {},
    depth: -1,
    id: randomId(),
    name: `${name}Context`,
    Provider: withProvider[providerName],
  } as any;
}

export function resolveContext<T>(map: ContextMap | undefined, ctx: Context<T>): T {
  const handle = map?.get(ctx.id);
  return (handle?.ref.current as T) ?? ctx.ref.current;
}
