/**
 * Built-in hooks for yielderact generator components.
 *
 * Hooks are generator functions called with `yield*` inside a component body.
 * Each hook yields a descriptor object; the renderer intercepts it, processes
 * the request (reads/writes persistent hook state), and sends the result back
 * via `gen.next(result)`.  The hook then returns that result to the caller.
 *
 * This design keeps hooks stateless and pure – they never directly access
 * module-level variables.  All state management happens in the renderer.
 *
 * @example
 * function* Counter(_props: object) {
 *   const [count, setCount] = yield* useState(0);
 *   return (
 *     <button onClick={() => setCount(count + 1)}>{count}</button>
 *   );
 * }
 */
export {
  USE_STATE,
  USE_REF,
  USE_ID,
  USE_MEMO,
  USE_RESOLVE_RAW,
  USE_RESOLVE,
  USE_EFFECT,
  USE_RENDER,
  USE_UI_PATCH,
  depsChanged,
} from './symbols';
export { useState } from './use-state';
export { type RefObject, useRef } from './use-ref';
export { useId } from './use-id';
export { useMemo } from './use-memo';
export {
  type Renderable,
  type UseResolveOptions,
  type ResolveRawResult,
  useResolveRaw,
  useResolve,
} from './use-resolve';
export { useEffect } from './use-effect';
export { type UseRenderFn, type UseRenderState, useRender, useResume } from './use-render';
export { useUIPatch } from './use-ui-patch';
export { usePatchContext } from './use-patch-context';
