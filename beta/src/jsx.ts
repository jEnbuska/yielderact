import type { Context } from "./context";
import type { ComponentGenerator, DependencyList } from "./hooks/types";
import type { IntrinsicElements as IntrinsicElementsDef } from "./jsx-types";
import type {
  ComponentSlotType,
  ContextSlotType,
  ElementSlot,
  ElementSlotType,
  FragmentSlotType,
} from "./slots/slot";

export const Fragment: unique symbol = Symbol("Fragment");

export type VNodeType<
  T extends FragmentSlotType | ContextSlotType | ComponentSlotType | ElementSlotType =
    | FragmentSlotType
    | ContextSlotType
    | ComponentSlotType
    | ElementSlotType,
> = T extends FragmentSlotType
  ? typeof Fragment
  : T extends ComponentSlotType
    ? Component<any>
    : T extends ContextSlotType
      ? Context
      : T extends ElementSlot
        ? keyof JSX.IntrinsicElements
        : never;

/** Virtual DOM node produced by the JSX runtime. */
export interface VNode<
  T extends FragmentSlotType | ContextSlotType | ComponentSlotType | ElementSlotType =
    | FragmentSlotType
    | ContextSlotType
    | ComponentSlotType
    | ElementSlotType,
> {
  type: VNodeType<T>;
  props: VNodeProps;
}

export type Child = VNode | string | number | bigint | boolean | null | undefined;
export type Children = Child | Children[];

export interface FrameworkProps {
  key?: string | number;
  shown?: boolean;
  deps?: DependencyList;
}

export interface PropsWithChildren extends FrameworkProps {
  children: Children;
}

export type VNodeProps = FrameworkProps & Record<string, unknown> & { children: Children };

export type Component<P extends Record<string, any> = Record<string, never>> = (
  props: P,
) => ComponentGenerator<Child>;

export type ComponentProps<T> = T extends keyof JSX.IntrinsicElements
  ? JSX.IntrinsicElements[T]
  : T extends Component<infer P>
    ? P
    : never;

declare global {
  namespace JSX {
    interface IntrinsicElements extends IntrinsicElementsDef {}
    interface IntrinsicAttributes extends FrameworkProps {}
    /** Use `children` as the JSX children attribute name. */
    interface ElementChildrenAttribute {
      children: Record<string, never>;
    }
    type LibraryManagedAttributes<_C, P> = "children" extends keyof P
      ? Omit<P, "children"> & { children: P["children"] }
      : P;
  }
}
