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
 * function* Counter() {
 *   const [count, setCount] = yield* useState(0);
 *   return (
 *     <button onClick={() => setCount(count + 1)}>{count}</button>
 *   );
 * }
 */

export type { HookDescriptor } from "./descriptors";
export {
  type ComponentGenerator,
  type DependencyList,
  depsChanged,
} from "./types";
export { useEffect } from "./useEffect";
export { useId } from "./useId";
export { useMemo } from "./useMemo";
export { type RefObject, useRef } from "./useRef";
export { type UseRenderFn, useRender, useResume } from "./useRender";
export {
  type Renderable,
  type ResolveRawResult,
  type UseResolveOptions,
  useResolve,
  useResolveRaw,
} from "./useResolve";
export { useState } from "./useState";
export { useUIPatch } from "./useUIPatch";
