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
 * Each `yield` produces the JSX for the current render.
 * The `rerender` callback – received as the second argument – can be
 * called from inside event handlers to advance the generator and
 * repaint the component.
 *
 * @example
 * function* Counter(props: { initial?: number }, rerender: () => void) {
 *   let count = props.initial ?? 0;
 *   while (true) {
 *     yield <button onClick={() => { count++; rerender(); }}>{count}</button>;
 *   }
 * }
 */
export type GeneratorComponentFn<P extends Record<string, unknown> = Record<string, unknown>> = (
  props: P,
  rerender: () => void
) => Generator<VNode | null | undefined>;

/**
 * A plain-function component (no state, returns JSX once).
 *
 * @example
 * function Greeting({ name }: { name: string }) {
 *   return <h1>Hello, {name}!</h1>;
 * }
 */
export type PlainComponentFn<P extends Record<string, unknown> = Record<string, unknown>> = (
  props: P
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
export function createElement(
  type: symbol,
  props: null,
  ...children: Child[]
): VNode;

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
