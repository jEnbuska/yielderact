/**
 * Built-in hooks for yielderact generator components.
 *
 * Hooks are generator functions called with `yield*` inside a component body.
 * They can either return a value immediately (like `useState`) or yield
 * intermediate VNodes that pause rendering until an async operation completes
 * (like `useResolve`).
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
// Module-level hook context – set by the renderer before each fresh run
// ---------------------------------------------------------------------------

let _currentRerender: (() => void) | null = null;
let _currentResume: (() => void) | null = null;
let _hookStates: unknown[] | null = null;
let _hookIndex = 0;

/**
 * Called by the renderer before executing a fresh generator body.
 * Sets the module-level hook context so hooks can read/write persistent state.
 *
 * @internal
 */
export function _initHooks(rerender: () => void, resume: () => void, states: unknown[]): void {
  _currentRerender = rerender;
  _currentResume = resume;
  _hookStates = states;
  _hookIndex = 0;
}

/**
 * Called by the renderer after executing a fresh generator body.
 * Clears the module-level hook context.
 *
 * @internal
 */
export function _clearHooks(): void {
  _currentRerender = null;
  _currentResume = null;
  _hookStates = null;
  _hookIndex = 0;
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
): Generator<never, [T, (value: T | ((prev: T) => T)) => void], unknown> {
  const rerender = _currentRerender!;
  const states = _hookStates!;
  const index = _hookIndex++;

  if (!(index in states)) {
    states[index] = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  }

  const value = states[index] as T;
  const setter = (newValue: T | ((prev: T) => T)): void => {
    states[index] =
      typeof newValue === 'function' ? (newValue as (prev: T) => T)(states[index] as T) : newValue;
    rerender();
  };

  return [value, setter];
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
export function* useRef<T>(initialValue: T): Generator<never, RefObject<T>, unknown> {
  const states = _hookStates!;
  const index = _hookIndex++;

  if (!(index in states)) {
    states[index] = { current: initialValue } as RefObject<T>;
  }

  return states[index] as RefObject<T>;
}

// ---------------------------------------------------------------------------
// useId
// ---------------------------------------------------------------------------

let _idCounter = 0;

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
export function* useId(): Generator<never, string, unknown> {
  const states = _hookStates!;
  const index = _hookIndex++;

  if (!(index in states)) {
    states[index] = `:r${_idCounter++}:`;
  }

  return states[index] as string;
}

// ---------------------------------------------------------------------------
// useMemo
// ---------------------------------------------------------------------------

type MemoState<T> = { value: T; deps: unknown[] };

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
export function useMemo<T>(fn: () => T, deps: []): Generator<never, T, unknown>;
export function useMemo<T, Deps extends [unknown, ...unknown[]]>(
  fn: (...args: Deps) => T,
  deps: [...Deps],
): Generator<never, T, unknown>;
export function* useMemo<T>(
  fn: (...args: unknown[]) => T,
  deps: unknown[],
): Generator<never, T, unknown> {
  const states = _hookStates!;
  const index = _hookIndex++;

  if (!(index in states) || depsChanged((states[index] as MemoState<T>).deps, deps)) {
    states[index] = { value: fn(...deps), deps } as MemoState<T>;
  }

  return (states[index] as MemoState<T>).value;
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

/** Returns true when the dependency arrays differ. */
function depsChanged(prev: unknown[] | undefined, next: unknown[]): boolean {
  if (prev === undefined) return true; // first run after idle
  if (prev.length !== next.length) return true;
  return prev.some((v, i) => !Object.is(v, next[i]));
}

// ---------------------------------------------------------------------------
// Internal resume context – set by useRender, consumed by useResume
// ---------------------------------------------------------------------------

const _resumeCtx = createContext<((value: unknown) => void) | null>(null);

/** Normalise a Renderable to a `Child` value the renderer can process. */
function toChild(renderable: Renderable): Child {
  if (renderable == null) return null;
  if (typeof renderable === 'function') {
    // Wrap a component function into a VNode so the renderer can mount it
    return { type: renderable as AnyComponentFn, props: {}, children: [] };
  }
  return renderable as Child;
}

// ---------------------------------------------------------------------------
// useResolveRaw
// ---------------------------------------------------------------------------

/**
 * The return type of `useResolveRaw`.
 * A discriminated union — narrow on `loading` or `error` to access `data`.
 */
export type ResolveRawResult<T, E = unknown> =
  | { data: T; loading: false; error: undefined }
  | { data: undefined; loading: true; error: undefined }
  | { data: undefined; loading: false; error: E };

type ResolveRawState<T, E> =
  | { promise: Promise<T>; status: 'pending' }
  | { promise: Promise<T>; status: 'resolved'; data: T }
  | { promise: Promise<T>; status: 'rejected'; error: E };

/**
 * Low-level async state hook for generator components.
 *
 * Takes a `Promise<T>` and returns the current state as a snapshot.
 * When the promise settles the component is re-rendered and the hook
 * returns updated values.
 *
 * Unlike `useResolve`, this hook does **not** pause rendering — the
 * component receives the state immediately and decides how to render it.
 * Combine with `useMemo` to memoize the promise factory:
 *
 * @example
 * function* UserProfile({ userId }: { userId: number }) {
 *   const promise = yield* useMemo(() => fetchUser(userId), [userId]);
 *   const { data, loading, error } = yield* useResolveRaw<User, Error>(promise);
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorMessage message={error.message} />;
 *   return <div>{data.name}</div>;
 * }
 */
export function* useResolveRaw<T, E = unknown>(
  promise: Promise<T>,
): Generator<never, ResolveRawResult<T, E>, unknown> {
  const rerender = _currentRerender!;
  const states = _hookStates!;
  const index = _hookIndex++;

  const existing = states[index] as ResolveRawState<T, E> | undefined;

  if (!existing || existing.promise !== promise) {
    const state: ResolveRawState<T, E> = { promise, status: 'pending' };
    states[index] = state;
    promise.then(
      (data) => {
        if (states[index] === state) {
          states[index] = { promise, status: 'resolved', data };
          rerender();
        }
      },
      (error: E) => {
        if (states[index] === state) {
          states[index] = { promise, status: 'rejected', error };
          rerender();
        }
      },
    );
  }

  const state = states[index] as ResolveRawState<T, E>;
  if (state.status === 'resolved') {
    return { data: state.data, loading: false, error: undefined };
  }
  if (state.status === 'rejected') {
    return { data: undefined, loading: false, error: state.error };
  }
  return { data: undefined, loading: true, error: undefined };
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
): Generator<Child, T, unknown> {
  // Memoize the promise factory inline — useMemo's overloads require deps as fn
  // args, but here deps are captured by closure and used for change-detection only.
  const states = _hookStates!;
  const memoIndex = _hookIndex++;
  if (
    !(memoIndex in states) ||
    depsChanged((states[memoIndex] as MemoState<Promise<T>>).deps, deps)
  ) {
    states[memoIndex] = { value: options.fn(), deps } as MemoState<Promise<T>>;
  }
  const promise = (states[memoIndex] as MemoState<Promise<T>>).value;

  const { data, loading, error } = yield* useResolveRaw<T, unknown>(promise);

  if (loading) {
    yield toChild(options.loading);
  }

  if (error !== undefined) {
    yield toChild(options.error);
  }

  return data as T;
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

type UseRenderState<T> = {
  status: 'waiting' | 'resolved';
  deps: unknown[];
  value: T | undefined;
  /** Stable callback reference – created once per deps change and reused. */
  resumeCallback: (value: T) => void;
};

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
export function useRender<T>(child: Child): Generator<Child, T, unknown>;
export function useRender<T>(fn: UseRenderFn<T>, deps: unknown[]): Generator<Child, T, unknown>;
export function* useRender<T>(
  fnOrChild: Child | UseRenderFn<T>,
  deps?: unknown[],
): Generator<Child, T, unknown> {
  const _resume = _currentResume!;
  const states = _hookStates!;
  const index = _hookIndex++;
  const effectiveDeps = deps ?? [];

  if (!(index in states) || depsChanged((states[index] as UseRenderState<T>).deps, effectiveDeps)) {
    // Create a stable callback that closes over `states` and `index`.
    // `_resume` is also stable – same function for the lifetime of the component instance.
    const resumeCallback = (value: T): void => {
      const s = states[index] as UseRenderState<T>;
      if (s.status === 'waiting') {
        s.status = 'resolved';
        s.value = value;
        _resume();
      }
    };
    states[index] = { status: 'waiting', deps: effectiveDeps, value: undefined, resumeCallback };
  } else {
    // Same deps – reuse the existing stable callback but reset status for this fresh run.
    // This line only executes during rerender() (fresh generator), never during gen.next() resumes.
    (states[index] as UseRenderState<T>).status = 'waiting';
  }

  const { resumeCallback } = states[index] as UseRenderState<T>;
  const isInline = typeof fnOrChild === 'function';

  while ((states[index] as UseRenderState<T>).status === 'waiting') {
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

  return (states[index] as UseRenderState<T>).value as T;
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
export function* useResume<T>(): Generator<never, (value: T) => void, unknown> {
  const fn = useContext(_resumeCtx);
  if (fn === null) {
    throw new Error('useResume must be called inside a component rendered by useRender');
  }
  return fn as (value: T) => void;
}
