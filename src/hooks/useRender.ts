import { type ContextEntry, createContext, useContext } from "../context";
import type { Child, VNode } from "../jsx";
import type { HookState } from "../render/types";
import { $USE_RENDER, type RenderDescriptor } from "./descriptors";
import type { ComponentGenerator, DependencyList } from "./types";
import { depsChanged } from "./types";

/**
 * Inline render factory passed to `useRender` (Variant 2).
 *
 * Receives `{ resume }` and must return the JSX to render while waiting.
 * Call `resume(value)` when the user has made a choice – this unblocks
 * the parent generator and makes `yield* useRender(...)` return `value`.
 */
export type UseRenderFn<T> = (props: { resume: (value: T) => void }) => Child;

/**
 * State object for one `useRender` hook slot.
 * Stored in the component's `hookStates` array by the renderer.
 * @internal
 */
export type UseRenderState<T> = {
  kind: typeof $USE_RENDER;
  status: "waiting" | "resolved";
  deps: DependencyList;
  value?: T;
  /** Stable callback reference – created once per deps change and reused. */
  resumeCallback: (value: T) => void;
};

// Internal context propagating the resume callback to child components.
const resumeCtx = createContext<((value: unknown) => void) | null>(null);

/**
 * Interactive render hook for components.
 *
 * Pauses the generator and renders UI until `resume(value)` is called.
 * Whatever is passed to `resume` is returned from `yield* useRender(...)`,
 * and the generator then continues from where it was paused.
 *
 * Two variants are supported:
 *
 * **Variant 1 – pass JSX directly.**  The rendered child component obtains
 * the `resume` callback via `yield* useResume()`:
 *
 * @example
 * // Child component – calls useResume to get the parent's resume callback
 * function* ConfirmDialog() {
 *   const resume = yield* useResume<'YES' | 'NO'>();
 *   return (
 *     <div>
 *       <button onClick={() => resume('YES')}>Yes</button>
 *       <button onClick={() => resume('NO')}>No</button>
 *     </div>
 *   );
 * }
 *
 * // Parent – passes JSX directly; resumes when the child calls resume()
 * function* Form() {
 *   const answer = yield* useRef<'YES' | 'NO' | null>(null);
 *   while (answer.current === null) {
 *     answer.current = yield* useRender<'YES' | 'NO'>(<ConfirmDialog />);
 *   }
 *   return <p>You chose: {answer.current}</p>;
 * }
 *
 * **Variant 2 – inline render function.**  `resume` is injected directly into
 * `fn` as a prop.  The required `deps` array controls when the rendered output
 * is considered stale – pass `[]` to render the same UI for the component's
 * lifetime, or pass values that, when changed, should reset the interaction:
 *
 * @example
 * function* Form() {
 *   const answer = yield* useRef<'YES' | 'NO' | null>(null);
 *   while (answer.current === null) {
 *     answer.current = yield* useRender<'YES' | 'NO'>(
 *       ({ resume }) => (
 *         <div>
 *           <button onClick={() => resume('YES')}>Yes</button>
 *           <button onClick={() => resume('NO')}>No</button>
 *         </div>
 *       ),
 *       [],
 *     );
 *   }
 *   return <p>You chose: {answer.current}</p>;
 * }
 *
 * Must be called with `yield*` inside a component.
 */
export function useRender<T>(child: Child): ComponentGenerator<T>;
export function useRender<T>(fn: UseRenderFn<T>, deps: DependencyList): ComponentGenerator<T>;
export function* useRender<T>(
  fnOrChild: Child | UseRenderFn<T>,
  deps?: DependencyList,
): ComponentGenerator<T> {
  // Request a persistent slot + stable resumeCallback from the renderer.
  const effectiveDeps = deps ?? [];
  const desc: RenderDescriptor = { type: $USE_RENDER, deps: effectiveDeps };
  const caps = yield desc;
  const { slot, resumeCallback } = caps as {
    slot: UseRenderState<T>;
    resumeCallback: (value: T) => void;
  };

  const isInline = typeof fnOrChild === "function";
  const resumeEntry = resumeCtx(resumeCallback as (value: unknown) => void);

  while (slot.status === "waiting") {
    const rawChild = isInline
      ? (fnOrChild as UseRenderFn<T>)({ resume: resumeCallback })
      : (fnOrChild as Child);
    // Attach resume context via context on the child VNode so nested
    // components can access `resume` via useResume().
    yield withContextEntry(rawChild, resumeEntry);
  }

  return slot.value as T;
}

/**
 * Returns the `resume` callback injected by the nearest parent `useRender` call.
 *
 * Calling `resume(value)` unblocks the parent generator, unmounts this
 * component, and makes `yield* useRender(...)` return `value`.  The component
 * itself does not need to do anything further after calling `resume` – the
 * parent takes over from that point.
 *
 * Must be called with `yield*` inside a component that is rendered
 * by a parent via `useRender` (Variant 1).  Throws if called outside that
 * context.
 *
 * @example
 * // Child – receives resume from the parent's useRender context
 * function* ConfirmDialog() {
 *   const resume = yield* useResume<'YES' | 'NO'>();
 *   return (
 *     <div>
 *       <button onClick={() => resume('YES')}>Yes</button>
 *       <button onClick={() => resume('NO')}>No</button>
 *     </div>
 *   );
 * }
 *
 * // Parent – passes the child via JSX; resumes when the child calls resume()
 * function* Form() {
 *   const answer = yield* useRef<'YES' | 'NO' | null>(null);
 *   while (answer.current === null) {
 *     answer.current = yield* useRender<'YES' | 'NO'>(<ConfirmDialog />);
 *   }
 *   return <p>You chose: {answer.current}</p>;
 * }
 */
export function* useResume<T>(): ComponentGenerator<(value: T) => void> {
  const fn = yield* useContext(resumeCtx);
  if (fn === null) {
    throw new Error("useResume must be called inside a component rendered by useRender");
  }
  return fn as (value: T) => void;
}

function isVNode(child: Child): child is VNode {
  return child !== null && child !== undefined && typeof child === "object";
}

/** Merge a ContextEntry into a child's context prop. */
function withContextEntry(child: Child, entry: ContextEntry): Child {
  if (!isVNode(child)) return child;
  const existing = child.props.$context;
  const merged = existing ? [...(Array.isArray(existing) ? existing : [existing]), entry] : entry;
  return {
    type: child.type,
    props: { ...child.props, $context: merged },
    children: child.children,
  };
}

/** @internal */
export function processRender(
  descriptor: RenderDescriptor,
  prev: UseRenderState<unknown> | undefined,
  hookStates: HookState[],
  hookIndex: number,
  resume: () => void,
): UseRenderState<unknown> {
  if (prev !== undefined && !depsChanged(prev.deps, descriptor.deps)) {
    prev.status = "waiting";
    return prev;
  }

  const resumeCallback = (value: unknown): void => {
    const s = hookStates[hookIndex] as UseRenderState<unknown> | undefined;
    if (s !== undefined && s.kind === $USE_RENDER && s.status === "waiting") {
      s.status = "resolved";
      s.value = value;
      resume();
    }
  };
  return {
    kind: $USE_RENDER,
    status: "waiting",
    deps: descriptor.deps,
    resumeCallback,
  };
}
