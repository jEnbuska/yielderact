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
import { type Child, type AnyComponentFn, createElement } from './jsx';
import { createContext, useContext } from './context';

// ---------------------------------------------------------------------------
// Hook descriptor symbols – exported so the renderer can identify them
// ---------------------------------------------------------------------------

/** @internal */
export const USE_STATE = Symbol('useState');
/** @internal */
export const USE_REF = Symbol('useRef');
/** @internal */
export const USE_ID = Symbol('useId');
/** @internal */
export const USE_MEMO = Symbol('useMemo');
/** @internal */
export const USE_RESOLVE = Symbol('useResolve');
/** @internal */
export const USE_RENDER = Symbol('useRender');

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Returns true when the dependency arrays differ (shallow Object.is comparison). */
export function depsChanged(prev: unknown[] | undefined, next: unknown[]): boolean {
  if (prev === undefined) return true;
  if (prev.length !== next.length) return true;
  return prev.some((v, i) => !Object.is(v, next[i]));
}

// ---------------------------------------------------------------------------
// useState
// ---------------------------------------------------------------------------

/**
 * Persistent state hook for generator components.
 *
 * Returns `[currentValue, setter]`. Calling the setter stores the new value
 * and triggers a re-render. The value persists across re-renders even though
 * the generator function body is re-executed from the top each time.
 *
 * Must be called with `yield*` inside a generator component or hook.
 *
 * @example
 * function* Counter(_props: object) {
 *   const [count, setCount] = yield* useState(0);
 *   return (
 *     <button onClick={() => setCount(count + 1)}>{count}</button>
 *   );
 * }
 *
 * // Lazy initializer – function is called only on the first render:
 * const [value, setValue] = yield* useState(() => expensiveComputation());
 *
 * // Functional updater – receives the previous state:
 * setValue(prev => prev + 1);
 *
 * NOTE: As in React, any function passed as `initialValue` or to the setter is
 * treated as a lazy initializer / updater respectively.  To store a function as
 * state, wrap it: `useState(() => myFn)` / `setState(() => newFn)`.
 */
export function* useState<T>(
  initialValue: T | (() => T),
): Generator<unknown, [T, (value: T | ((prev: T) => T)) => void], unknown> {
  const stateTuple = yield { type: USE_STATE, initialValue };
  return stateTuple as [T, (value: T | ((prev: T) => T)) => void];
}

// ---------------------------------------------------------------------------
// useRef
// ---------------------------------------------------------------------------

/**
 * A mutable ref object whose `.current` property persists across re-renders.
 */
export interface RefObject<T> {
  current: T;
}

/**
 * Persistent mutable ref hook for generator components.
 *
 * Returns a stable `{ current }` object whose value persists across re-renders
 * without triggering a re-render when mutated.
 *
 * Must be called with `yield*` inside a generator component or hook.
 *
 * @example
 * function* InputFocus(_props: object) {
 *   const ref = yield* useRef<HTMLInputElement | null>(null);
 *   return <input ref={ref} />;
 * }
 */
export function* useRef<T>(initialValue: T): Generator<unknown, RefObject<T>, unknown> {
  const ref = yield { type: USE_REF, initialValue };
  return ref as RefObject<T>;
}

// ---------------------------------------------------------------------------
// useId
// ---------------------------------------------------------------------------

/**
 * Stable unique ID hook for generator components.
 *
 * Returns a string ID that is stable across re-renders and unique per hook
 * call site within the application.
 *
 * Must be called with `yield*` inside a generator component or hook.
 *
 * @example
 * function* LabelledInput(_props: object) {
 *   const id = yield* useId();
 *   return (
 *     <>
 *       <label htmlFor={id}>Name</label>
 *       <input id={id} />
 *     </>
 *   );
 * }
 */
export function* useId(): Generator<unknown, string, unknown> {
  const id = yield { type: USE_ID };
  return id as string;
}

// ---------------------------------------------------------------------------
// useMemo
// ---------------------------------------------------------------------------

/**
 * Memoized value hook for generator components.
 *
 * Calls `fn(...deps)` on the first render and re-calls it only when the
 * dependency values change (shallow `Object.is` comparison).  The previous
 * result is returned unchanged between dependency updates.
 *
 * Unlike React's `useMemo`, the dependency values are forwarded as arguments
 * to the factory function.
 *
 * Must be called with `yield*` inside a generator component or hook.
 *
 * @example
 * function* Expensive({ a, b }: { a: number; b: number }) {
 *   const result = yield* useMemo((a, b) => heavyCalc(a, b), [a, b]);
 *   return <div>{result}</div>;
 * }
 */
export function useMemo<T>(fn: () => T, deps: []): Generator<unknown, T, unknown>;
export function useMemo<T, Deps extends [unknown, ...unknown[]]>(
  fn: (...args: Deps) => T,
  deps: [...Deps],
): Generator<unknown, T, unknown>;
export function* useMemo<T>(
  fn: (...args: unknown[]) => T,
  deps: unknown[],
): Generator<unknown, T, unknown> {
  const value = yield { type: USE_MEMO, fn, deps };
  return value as T;
}

// ---------------------------------------------------------------------------
// useResolve
// ---------------------------------------------------------------------------

/**
 * A value that can be rendered: a VNode-like child, a component function,
 * or null/undefined (renders nothing).
 */
export type Renderable = Child | AnyComponentFn;

/** Options accepted by `useResolve`. */
export interface UseResolveOptions<T> {
  /** A factory that creates the promise. Called once per component instance (or when `deps` change). */
  fn: () => Promise<T>;
  /** Shown while the promise is pending. Can be a VNode or component function. */
  loading: Renderable;
  /** Shown when the promise rejects. Can be a VNode or component function. */
  error: Renderable;
}

/**
 * State object for one `useResolve` hook slot.
 * Stored in the component's `hookStates` array by the renderer.
 * @internal
 */
export type PromiseHookState<T> =
  | { status: 'idle'; gen: number }
  | { status: 'pending'; gen: number; deps: unknown[] }
  | { status: 'resolved'; data: T; gen: number; deps: unknown[] }
  | { status: 'rejected'; reason: unknown; gen: number; deps: unknown[] };

/** Normalise a Renderable to a `Child` value the renderer can process. */
function toChild(renderable: Renderable): Child {
  if (renderable == null) return null;
  if (typeof renderable === 'function') {
    return { type: renderable as AnyComponentFn, props: {}, children: [] };
  }
  return renderable as Child;
}

/**
 * Async data hook for generator components.
 *
 * Pauses rendering (yields a loading VNode) until the promise resolves.
 * If the promise rejects, the error VNode is shown indefinitely.
 * Once resolved the hook returns the data and the component continues.
 *
 * The `deps` array is required. The promise is re-run whenever any dependency
 * value changes (useful for re-fetching when an ID or search term changes).
 * Pass an empty array `[]` to run the promise exactly once per component instance.
 *
 * Must be called with `yield*` inside a generator component.
 *
 * @example
 * function* UserProfile({ userId }: { userId: number }) {
 *   const user = yield* useResolve({
 *     fn: () => fetchUser(userId),
 *     loading: <Spinner />,
 *     error: <ErrorMessage />,
 *   }, [userId]);
 *   return <div>{user.name}</div>;
 * }
 */
export function* useResolve<T>(
  options: UseResolveOptions<T>,
  deps: unknown[],
): Generator<unknown, T, unknown> {
  // Request a persistent state slot and the instance's resume callback from the renderer.
  const caps = yield { type: USE_RESOLVE };
  const { slot: rawSlot, resume } = caps as { slot: PromiseHookState<T>; resume: () => void };
  // Cast to a mutable reference so the hook can update state freely.
  const stateRef = rawSlot as Record<string, unknown> & { status: string };

  // Reset to idle when deps have changed so the promise is re-run.
  if (stateRef.status !== 'idle' && depsChanged(stateRef['deps'] as unknown[], deps)) {
    stateRef.status = 'idle';
  }

  if (stateRef.status === 'idle') {
    const currentGen = (stateRef['gen'] as number) + 1;
    stateRef['gen'] = currentGen;
    stateRef['deps'] = deps;
    stateRef.status = 'pending';
    options
      .fn()
      .then((data: T) => {
        if (stateRef.status === 'pending' && stateRef['gen'] === currentGen) {
          stateRef.status = 'resolved';
          stateRef['data'] = data;
          resume();
        }
      })
      .catch((reason: unknown) => {
        if (stateRef.status === 'pending' && stateRef['gen'] === currentGen) {
          stateRef.status = 'rejected';
          stateRef['reason'] = reason;
          resume();
        }
      });
  }

  // Yield the loading VNode on each resume while the promise is still pending.
  while (stateRef.status === 'pending') {
    yield toChild(options.loading);
  }

  // Yield the error VNode while in the rejected state (no retry by default).
  while (stateRef.status === 'rejected') {
    yield toChild(options.error);
  }

  // State must be 'resolved' now – return the data to the component.
  return stateRef['data'] as T;
}

// ---------------------------------------------------------------------------
// useRender
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// useResume
// ---------------------------------------------------------------------------

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
