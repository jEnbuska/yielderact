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
 * temporarily intercept rendering (e.g. `usePromise` shows a loading state
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
 *   const user = yield* usePromise({
 *     fn: () => fetchUser(1),
 *     loading: <Spinner />,
 *     error:   <ErrorMsg />,
 *   });
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

// Overload 1: HTML element (string tag)
export function createElement(
  type: string,
  props: Record<string, unknown> | null,
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
 * Only `IntrinsicElements` is declared here.  `JSX.Element` is intentionally
 * omitted so TypeScript falls back to the return type of the `jsx()` factory
 * (i.e. `VNode`), which means:
 *   - Plain-function components that return `VNode` are accepted.
 *   - Generator components that return `Generator<Child, Child, unknown>` are
 *     also accepted without a type error.
 *
 * `IntrinsicElements` uses an index signature so every lowercase HTML / SVG
 * tag is accepted without needing an exhaustive element map.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    /** Permits any intrinsic element name (e.g. `<div>`, `<span>`, …). */
    interface IntrinsicElements {
      [elemName: string]: Record<string, unknown>;
    }
  }
}
