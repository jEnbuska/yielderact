import type { Context } from "./context";
import type { IntrinsicElements as IntrinsicElementsDef } from "./jsx-types";
import type { ComponentGenerator, DependencyList } from "./general-types";
import type { Draft } from "./slots/draft";

export const Fragment: unique symbol = Symbol("Fragment");

export type Child = Draft | string | number | bigint | boolean | null | undefined;
export type Children = Child | ReadonlyArray<Children>;

export interface FrameworkProps {
  key?: string;
  deps?: DependencyList;
}

export interface PropsWithChildren {
  children: Children;
}

export type Component<P extends Record<string, any> = Record<string, never>> = (
  props: P,
) => ComponentGenerator;

export type ComponentProps<T> = T extends keyof JSX.IntrinsicElements
  ? JSX.IntrinsicElements[T]
  : T extends Component<infer P>
    ? P
    : never;

declare global {
  namespace JSX {
    type ElementType = string | typeof Fragment | Component<any> | Context;
    interface IntrinsicElements extends IntrinsicElementsDef {}
    interface IntrinsicAttributes extends FrameworkProps {}
    /** Use `children` as the JSX children attribute name. */
    interface ElementChildrenAttribute {
      children: Record<string, never>;
    }
    type LibraryManagedAttributes<_C, P> = "children" extends keyof P
      ? Omit<P, "children"> & { children?: P["children"] }
      : P;
  }
}
