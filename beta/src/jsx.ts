import type { Context } from "./context";
import type { ComponentGenerator, DependencyList } from "./hooks/types";
import type { IntrinsicElements as IntrinsicElementsDef } from "./jsx-types";

/** Fragment VNode type — children flatten through the reconciler. */
export const Fragment: unique symbol = Symbol("Fragment");

// `Component<any>` widens the union so VNode.type accepts components with
// any prop shape — function-parameter contravariance otherwise rejects
// concrete prop types when the union member is the narrow `Component<FrameworkProps>`.

export type VNodeType = typeof Fragment | Component<any> | Context | keyof JSX.IntrinsicElements;

/** Virtual DOM node produced by the JSX runtime. */
export interface VNode<T extends VNodeType = VNodeType> {
  type: T;
  props: VNodeProps;
}
/**
 * Anything that can appear as a child in the virtual DOM.
 *
 * `Child` is recursive: nested arrays of children are valid input.
 * The reconciler wraps each nested array into a Fragment slot lazily
 * at reconciliation time, so each nested array becomes a stable inner
 * slot whose own children are reconciled in place across renders.
 */
export type SingleChild = VNode | string | number | boolean | null | undefined;
export type Child = SingleChild | Child[];

/**
 * Framework props valid on every JSX element. Consumed by the framework
 * and never rendered as DOM attributes. Stripped from the props object
 * before the component generator is called — components do not see them
 * in their `props` argument.
 *
 * `ref` is intentionally NOT here — it lives on `HTMLAttributes` /
 * `SVGAttributes` so it's only valid on element VNodes. A component that
 * wants to accept `ref` must declare it explicitly in its own prop type.
 */
export interface FrameworkProps {
  /** Reconciliation key — not rendered to the DOM. */
  key?: string | number;
  /** When false, the element/component is replaced by an empty slot. */
  shown?: boolean;
  /**
   * Dependency array for reconciliation memoization. When present, replaces
   * the default `shallowEqual` props check with a `depsChanged()` comparison
   * — the component only rerenders when at least one element changes.
   */
  deps?: DependencyList;
}

/**
 * Opt-in for components that accept JSX children. The required `children`
 * field is what discriminates children-accepting from children-rejecting
 * components in the `jsx` runtime overloads — making it optional would
 * collapse the two overloads to the same constraint.
 */
export interface PropsWithChildren extends FrameworkProps {
  children: Child | Child[];
}

/**
 * Runtime storage type for a VNode's props. The reconciler, instances, and
 * helpers iterate this freely; user-supplied props live under arbitrary keys,
 * hence the index signature. Component-author types (`FrameworkProps`,
 * `PropsWithChildren`) are narrower to drive JSX validation.
 */
export type VNodeProps = FrameworkProps & Record<string, unknown> & { children: Child };

/**
 * A generator component.
 *
 * @example
 * function* Counter(_props: object) {
 *   const [count, setCount] = yield* $state(0);
 *   return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
 * }
 */
export type Component<P extends Record<string, any> = Record<string, never>> = (
  props: P,
) => ComponentGenerator<SingleChild>;

/**
 * Extract the props type from an intrinsic element tag name or a component.
 *
 * @example
 * type TdProps = ComponentProps<'td'>;
 * type RowProps = ComponentProps<typeof TableRow>;
 */
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
    /**
     * Bridge: components declare `children` (framework `$`-prefix
     * convention), but TS's automatic JSX runtime hardcodes `children` as
     * the JSX-to-runtime prop name when validating components. This
     * conditional rewrites a component's `children` field to `children`
     * for the duration of JSX attribute validation, so users can write
     * `<Layout>x</Layout>` or `<Layout children={x} />` while authors still
     * declare `children` and read `props.children` at runtime.
     *
     * Components without `children` in their prop type pass through
     * unchanged, so excess `children` on a no-children component is still
     * rejected.
     *
     * Both `_C` and `P` type params must be present even though `_C` is
     * unused — TS silently skips `LibraryManagedAttributes` aliases that
     * don't accept both parameters (TS issue #42240).
     */
    type LibraryManagedAttributes<_C, P> = "children" extends keyof P
      ? Omit<P, "children"> & { children: P["children"] }
      : P;
  }
}
