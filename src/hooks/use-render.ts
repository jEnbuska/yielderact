import { type Child, createElement } from '../jsx';
import { createContext, useContext } from '../context';
import { USE_RENDER } from './symbols';

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
  status: 'waiting' | 'resolved';
  deps: unknown[];
  value: T | undefined;
  /** Stable callback reference – created once per deps change and reused. */
  resumeCallback: (value: T) => void;
};

// Internal context propagating the resume callback to child components.
const _resumeCtx = createContext<((value: unknown) => void) | null>(null);

/**
 * Interactive render hook for generator components.
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
 * function* ConfirmDialog(_props: object) {
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
 * function* Form(_props: object) {
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
 * function* Form(_props: object) {
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
 * Must be called with `yield*` inside a generator component.
 */
export function useRender<T>(child: Child): Generator<unknown, T, unknown>;
export function useRender<T>(fn: UseRenderFn<T>, deps: unknown[]): Generator<unknown, T, unknown>;
export function* useRender<T>(
  fnOrChild: Child | UseRenderFn<T>,
  deps?: unknown[],
): Generator<unknown, T, unknown> {
  // Request a persistent slot + stable resumeCallback from the renderer.
  const effectiveDeps = deps ?? [];
  const caps = yield { type: USE_RENDER, deps: effectiveDeps };
  const { slot, resumeCallback } = caps as {
    slot: UseRenderState<T>;
    resumeCallback: (value: T) => void;
  };

  const isInline = typeof fnOrChild === 'function';

  while (slot.status === 'waiting') {
    const rawChild = isInline
      ? (fnOrChild as UseRenderFn<T>)({ resume: resumeCallback })
      : (fnOrChild as Child);
    // Wrap in the internal resume context so nested components can access `resume` via useResume().
    yield createElement(
      _resumeCtx.Provider,
      { value: resumeCallback as (value: unknown) => void },
      rawChild,
    );
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
 * Must be called with `yield*` inside a generator component that is rendered
 * by a parent via `useRender` (Variant 1).  Throws if called outside that
 * context.
 *
 * @example
 * // Child – receives resume from the parent's useRender context
 * function* ConfirmDialog(_props: object) {
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
 * function* Form(_props: object) {
 *   const answer = yield* useRef<'YES' | 'NO' | null>(null);
 *   while (answer.current === null) {
 *     answer.current = yield* useRender<'YES' | 'NO'>(<ConfirmDialog />);
 *   }
 *   return <p>You chose: {answer.current}</p>;
 * }
 */
export function* useResume<T>(): Generator<unknown, (value: T) => void, unknown> {
  const fn = yield* useContext(_resumeCtx);
  if (fn === null) {
    throw new Error('useResume must be called inside a component rendered by useRender');
  }
  return fn as (value: T) => void;
}
