import type { ContextEntry } from "./context";
import type { ComponentGenerator, DependencyList } from "./hooks/types";
import type { IntrinsicElements as IntrinsicElementsDef } from "./jsx-types";

export type VNodeType = string | symbol | Component;
/**
 * Virtual DOM node produced by createElement / JSX.
 */
export interface VNode<T extends VNodeType = VNodeType> {
  type: T;
  props: InternalProps;
  children: Child[];
}

/**
 * Anything that can appear as a child in the virtual DOM.
 */
export type Child = VNode | string | number | boolean | null | undefined;

/**
 * Framework props valid on **every** JSX element — both intrinsic HTML/SVG
 * elements and custom components — without needing to be declared
 * in the component's own props type.
 *
 * These are consumed by the framework and **never** rendered as DOM attributes.
 */
export interface FrameworkProps {
  /** Reconciliation key — not rendered to the DOM. Must be a string. */
  key?: string;
  /** When false, the element/component is removed from the DOM. */
  $shown?: boolean;
  /**
   * Marks this subtree as deferred.
   *
   * Currently a no-op — the deferred rendering model is being redesigned
   * (see issue #153). The prop is accepted but has no effect.
   */
  $deferred?: boolean;
  /**
   * Dependency array for reconciliation memoization.
   *
   * When present, replaces the default `shallowEqual` props check with a
   * `depsChanged()` comparison — the same mechanism used by hooks. The
   * component or element only rerenders/updates when the deps change.
   *
   * Useful when a parent passes new object references but the component
   * only cares about a subset of values.
   */
  $deps?: DependencyList;
  /**
   * Provide context values to this element/component and its descendants.
   *
   * Accepts a single `ContextEntry` or an array for multiple contexts.
   * Create entries by calling a context object: `MyCtx(value)`.
   *
   * @example
   * const ThemeCtx = createContext<'light' | 'dark'>('light');
   * <Child context={ThemeCtx('dark')} />
   * <div context={[ThemeCtx('dark'), LocaleCtx('fi')]}>...</div>
   */
  $context?: ContextEntry | ContextEntry[];
}

/**
 * Full set of special props for intrinsic HTML/SVG elements.
 *
 * Extends {@link FrameworkProps} with `children` and `ref`, which are
 * only available on elements and on components that explicitly declare them.
 *
 * @typeParam TRef - The concrete element type for `ref`.
 *   Narrowed to the specific `HTMLElement` / `SVGElement` subtype in
 *   per-element attribute interfaces.
 */
export interface SpecialProps<TRef = unknown> extends FrameworkProps {
  /** Nested children passed to the component or element. */
  children?: Child | Child[];
  /** Ref object — `.current` is set to the DOM element on mount, `undefined` on unmount. */
  ref?: { current: TRef | undefined };
}

/**
 * Props object as stored and passed internally by the framework.
 *
 * Combines the well-typed framework props (`SpecialProps`) with an open
 * string index for arbitrary user-defined props.
 *
 * Use this instead of raw `Record<string, unknown>` whenever a function
 * receives or returns a merged/internal props object.
 */
export type InternalProps = SpecialProps & Record<string, unknown>;

/**
 * A component.
 *
 * The component body runs from top to bottom on each render and **returns**
 * its JSX (not `yield`s it).  Hooks are invoked with `yield*` and may
 * temporarily intercept rendering (e.g. `useResolve` shows a loading state
 * while a promise is pending).
 *
 * Call `rerender()` (the second argument) or use a hook setter to trigger
 * a re-render; the generator body is re-executed from the top and the DOM
 * is reconciled with the new output.
 *
 * @example
 * function* Counter(_props: object) {
 *   const [count, setCount] = yield* useState(0);
 *   return (
 *     <button onClick={() => setCount(count + 1)}>{count}</button>
 *   );
 * }
 *
 * @example
 * function* UserCard(_props: object) {
 *   const user = yield* useResolve({
 *     fn: () => fetchUser(1),
 *     loading: <Spinner />,
 *     error:   <ErrorMsg />,
 *   }, []);
 *   return <div>{user.name}</div>;
 * }
 */
export type Component<P extends InternalProps = InternalProps> = (
  props: P,
  rerender: () => Promise<void>,
) => ComponentGenerator<Child>;

/**
 * Internal raw fragment symbol — the primitive grouping mechanism used by
 * `buildNode` and `flattenChildren`. Not part of the public API.
 *
 * @internal
 */
export const RawFragment: unique symbol = Symbol("RawFragment");

/**
 * Fragment component — use instead of a wrapper element when you need to
 * return multiple children.
 *
 * Framework directives (`context`, `$deferred`) placed on a Fragment
 * work correctly because Fragment is a real component that participates
 * in the normal lifecycle (mount, reconcile, propagate).
 *
 * @example
 * function* List() {
 *   return (
 *     <>
 *       <li>One</li>
 *       <li>Two</li>
 *     </>
 *   );
 * }
 */
export function* Fragment(props: InternalProps): ComponentGenerator<Child> {
  const children = props.children as Child[] | undefined;
  return { type: RawFragment, props: {}, children: children ?? [] } satisfies VNode;
}

/**
 * Portal symbol – used as the `type` of VNodes created by `createPortal`.
 *
 * Portal VNodes render their children into an arbitrary DOM container
 * outside the render root, while maintaining component-tree context
 * (`context`, `$deferred`).
 */
export const Portal: unique symbol = Symbol("Portal");

/**
 * Create a portal that renders children into a DOM container outside
 * the render root.
 *
 * @example
 * function* App() {
 *   return createPortal(<Modal />, document.body);
 * }
 *
 * @param children  - The children to render into the container.
 * @param container - The target DOM element.
 * @param key       - Optional reconciliation key.
 * @returns A VNode with `type = Portal`.
 */
export function createPortal(children: Child | Child[], container: Element, key?: string): VNode {
  const childArray = Array.isArray(children) ? children : [children];
  const props: InternalProps = { $portalContainer: container } satisfies InternalProps;
  if (key != null) props.key = String(key);
  return { type: Portal, props, children: childArray };
}

// ---------------------------------------------------------------------------
// createElement overloads
// ---------------------------------------------------------------------------

/**
 * JSX factory – called by the TypeScript/Babel JSX transform for every
 * JSX expression.
 *
 * You can also call it directly:
 *   createElement('div', { className: 'box' }, 'hello')
 *   createElement(MyComponent, { name: 'world' })
 */

// Overload 1: intrinsic HTML / SVG element (validated tag name)
export function createElement<T extends keyof JSX.IntrinsicElements>(
  type: T,
  props: JSX.IntrinsicElements[T] | null,
  ...children: Child[]
): VNode;

// Overload 2: component function
export function createElement<P extends InternalProps>(
  type: Component<P>,
  props: P | null,
  ...children: Child[]
): VNode;

// Overload 3: symbol (RawFragment, Portal)
export function createElement(type: symbol, props: null, ...children: Child[]): VNode;

// Overload 4: escape-hatch (jsx-runtime, dynamic types)
export function createElement(
  type: VNode["type"],
  props: Record<string, unknown> | null,
  ...children: Child[]
): VNode;

// Implementation
export function createElement(
  type: VNode["type"],
  props: Record<string, unknown> | null,
  ...children: Child[]
): VNode {
  return {
    type,
    props: (props ?? {}) satisfies InternalProps,
    children: children.flat() satisfies Child[],
  };
}

/**
 * Global JSX namespace – required by TypeScript to type-check JSX expressions
 * for both the classic transform (`jsxFactory: "createElement"`) and the
 * automatic transform (`jsxImportSource: "yract"`).
 *
 * `IntrinsicElements` is derived from {@link IntrinsicElementsDef} in
 * `jsx-types.ts`, which provides strongly-typed props for every standard
 * HTML and SVG element.  Only valid element names are accepted – arbitrary
 * strings cause a compile-time error.
 *
 * `JSX.Element` is intentionally omitted so TypeScript falls back to the
 * return type of the `jsx()` factory (i.e. `VNode`), which means generator
 * components that return `ComponentGenerator<Child>` are accepted without
 * a type error.
 */
declare global {
  namespace JSX {
    interface IntrinsicElements extends IntrinsicElementsDef {}
    /**
     * Props that are valid on every JSX element — both intrinsic HTML/SVG
     * elements and custom components — without needing to be
     * declared in the component's own props type.
     *
     * Only framework-level props (`key`, `$shown`, `$deferred`,
     * `$deps`, `context`) are universally available. `children` and `ref` must be
     * explicitly declared in a component's props type to be accepted.
     */
    interface IntrinsicAttributes extends FrameworkProps {}
  }
}
