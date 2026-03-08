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
 *   const [count, setCount] = yield* $state(0);
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
export { $state } from './use-state';
export { type RefObject, $ref } from './use-ref';
export { $id } from './use-id';
export { $memo } from './use-memo';
export {
  type Renderable,
  type UseResolveOptions,
  type ResolveRawResult,
  $resolveRaw,
  $resolve,
} from './use-resolve';
export { $effect } from './use-effect';
export { type UseRenderFn, type UseRenderState, $render, $resume } from './use-render';
export { $uiPatch } from './use-ui-patch';
export { $patchContext } from './use-patch-context';
