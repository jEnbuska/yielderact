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
  $STATE,
  $REF,
  $ID,
  $MEMO,
  $RESOLVE_RAW,
  $RESOLVE,
  $EFFECT,
  $RENDER,
  $UI_PATCH,
  depsChanged,
  type HookContext,
} from './symbols';
export { $state } from './$state';
export { type RefObject, $ref } from './$ref';
export { $id } from './$id';
export { $memo } from './$memo';
export {
  type Renderable,
  type UseResolveOptions,
  type ResolveRawResult,
  $resolveRaw,
  $resolve,
} from './$resolve';
export { $effect } from './$effect';
export { type UseRenderFn, type UseRenderState, $render, $resume } from './$render';
export { $uiPatch } from './$ui-patch';
export { $patchContext } from './$patch-context';
