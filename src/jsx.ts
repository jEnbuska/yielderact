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
 * function* Counter(props: {}, rerender: () => void) {
 *   let count = 0;
 *   while (true) {
 *     yield <button onClick={() => { count++; rerender(); }}>{count}</button>;
 *   }
 * }
 */
export type GeneratorComponentFn = (
  props: Record<string, unknown>,
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
export type PlainComponentFn = (
  props: Record<string, unknown>
) => VNode | null | undefined;

export type AnyComponentFn = GeneratorComponentFn | PlainComponentFn;

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

/**
 * JSX factory – called by the TypeScript/Babel JSX transform for every
 * JSX expression.
 *
 * You can also call it directly:
 *   createElement('div', { className: 'box' }, 'hello')
 */
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
