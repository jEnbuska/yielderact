import type { IntrinsicElements as IntrinsicElementsDef } from './jsx-types';

/**
 * Virtual DOM node produced by createElement / JSX.
 */
export interface VNode {
  type: string | symbol | AnyComponentFn;
  props: Record<string, unknown>;
  children: Child[];
}

/**
 * Anything that can appear as a child in the virtual DOM.
 */
export type Child = VNode | string | number | boolean | null | undefined;

/**
 * A generator-function component.
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
export type GeneratorComponentFn<P extends Record<string, unknown> = Record<string, unknown>> = (
  props: P,
  rerender: () => void,
) => Generator<Child, Child, unknown>;

/**
 * A plain-function component (no state, returns JSX once).
 *
 * @example
 * function Greeting({ name }: { name: string }) {
 *   return <h1>Hello, {name}!</h1>;
 * }
 */
export type PlainComponentFn<P extends Record<string, unknown> = Record<string, unknown>> = (
  props: P,
) => VNode | null | undefined;

export type AnyComponentFn<P extends Record<string, unknown> = Record<string, unknown>> =
  | GeneratorComponentFn<P>
  | PlainComponentFn<P>;

/**
 * Fragment symbol – use instead of a wrapper element when you need to
 * return multiple children.
 *
 * @example
 * function* List() {
 *   yield (
 *     <>
 *       <li>One</li>
 *       <li>Two</li>
 *     </>
 *   );
 * }
 */
export const Fragment: unique symbol = Symbol('Fragment');

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

// Overload 2: typed component function
export function createElement<P extends Record<string, unknown>>(
  type: AnyComponentFn<P>,
  props: P | null,
  ...children: Child[]
): VNode;

// Overload 3: symbol (Fragment)
export function createElement(type: symbol, props: null, ...children: Child[]): VNode;

// Overload 4: escape-hatch (union type)
export function createElement(
  type: VNode['type'],
  props: Record<string, unknown> | null,
  ...children: Child[]
): VNode;

// Implementation
export function createElement(
  type: VNode['type'],
  props: Record<string, unknown> | null,
  ...children: Child[]
): VNode {
  return {
    type,
    props: props ?? {},
    children: children.flat() as Child[],
  };
}

/**
 * Global JSX namespace – required by TypeScript to type-check JSX expressions
 * for both the classic transform (`jsxFactory: "createElement"`) and the
 * automatic transform (`jsxImportSource: "yielderact"`).
 *
 * `IntrinsicElements` is derived from {@link IntrinsicElementsDef} in
 * `jsx-types.ts`, which provides strongly-typed props for every standard
 * HTML and SVG element.  Only valid element names are accepted – arbitrary
 * strings cause a compile-time error.
 *
 * `JSX.Element` is intentionally omitted so TypeScript falls back to the
 * return type of the `jsx()` factory (i.e. `VNode`), which means:
 *   - Plain-function components that return `VNode` are accepted.
 *   - Generator components that return `Generator<Child, Child, unknown>` are
 *     also accepted without a type error.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements extends IntrinsicElementsDef {}
  }
}
