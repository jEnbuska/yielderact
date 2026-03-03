/**
 * yielderact – JSX UI library powered by JavaScript generators.
 *
 * Components are generator functions that **return** their JSX.
 * Hooks are called with `yield*` and may pause rendering until async
 * operations complete.
 *
 * Quick-start:
 *
 * ```tsx
 * import { render, useState } from 'yielderact';
 *
 * function* Counter(_props: object) {
 *   const [count, setCount] = yield* useState(0);
 *   return (
 *     <button onClick={() => setCount(count + 1)}>
 *       Clicked {count} times
 *     </button>
 *   );
 * }
 *
 * render(<Counter />, document.getElementById('root')!);
 * ```
 */
export { createElement, Fragment } from './jsx';
export { render } from './render';
export { createContext, useContext } from './context';
export { useState, usePromise } from './hooks';
export type { VNode, Child, GeneratorComponentFn, PlainComponentFn, AnyComponentFn } from './jsx';
export type { Context } from './context';
export type { SyntheticEvent, SEvent } from './events';
export type { UsePromiseOptions, Renderable } from './hooks';
