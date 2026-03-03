/**
 * yielderact – JSX UI library powered by JavaScript generators.
 *
 * Components are generator functions.  Each `yield` statement produces
 * the JSX for the current render.  Calling `rerender()` (passed as the
 * second argument to every generator component) advances the generator
 * and repaints only that component.
 *
 * Quick-start:
 *
 * ```tsx
 * import { createElement, Fragment, render } from 'yielderact';
 *
 * function* Counter(props: {}, rerender: () => void) {
 *   let count = 0;
 *   while (true) {
 *     yield (
 *       <button onClick={() => { count++; rerender(); }}>
 *         Clicked {count} times
 *       </button>
 *     );
 *   }
 * }
 *
 * render(<Counter />, document.getElementById('root')!);
 * ```
 */
export { createElement, Fragment } from './jsx';
export { render } from './render';
export type { VNode, Child, GeneratorComponentFn, PlainComponentFn, AnyComponentFn } from './jsx';
