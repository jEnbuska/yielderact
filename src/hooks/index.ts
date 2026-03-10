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

export { $effect } from "./$effect";
export { $id } from "./$id";
export { $memo } from "./$memo";
export { $patchContext } from "./$patch-context";
export { $ref, type RefObject } from "./$ref";
export { $render, $resume, type UseRenderFn, type UseRenderState } from "./$render";
export {
  $resolve,
  $resolveRaw,
  type Renderable,
  type ResolveRawResult,
  type UseResolveOptions,
} from "./$resolve";
export { $state } from "./$state";
export { $uiPatch } from "./$ui-patch";
export {
  $EFFECT,
  $ID,
  $MEMO,
  $REF,
  $RENDER,
  $RESOLVE,
  $RESOLVE_RAW,
  $STATE,
  $UI_PATCH,
  type DependencyList,
  depsChanged,
  type HookContext,
} from "./symbols";
