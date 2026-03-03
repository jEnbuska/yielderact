/**
 * Built-in hooks for yielderact generator components.
 *
 * Hooks are generator functions called with `yield*` inside a component body.
 * They can either return a value immediately (like `useState`) or yield
 * intermediate VNodes that pause rendering until an async operation completes
 * (like `usePromise`).
 *
 * @example
 * function* Counter(_props: object) {
 *   const [count, setCount] = yield* useState(0);
 *   return (
 *     <button onClick={() => setCount(count + 1)}>{count}</button>
 *   );
 * }
 */
import { type Child, type AnyComponentFn } from './jsx';

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
 */
export function* useState<T>(initialValue: T): Generator<never, [T, (value: T) => void], unknown> {
  const rerender = _currentRerender!;
  const states = _hookStates!;
  const index = _hookIndex++;

  if (!(index in states)) {
    states[index] = initialValue;
  }

  const value = states[index] as T;
  const setter = (newValue: T): void => {
    states[index] = newValue;
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
// usePromise
// ---------------------------------------------------------------------------

/**
 * A value that can be rendered: a VNode-like child, a component function,
 * or null/undefined (renders nothing).
 */
export type Renderable = Child | AnyComponentFn;

/** Options accepted by `usePromise`. */
export interface UsePromiseOptions<T> {
  /** A factory that creates the promise. Called once per component instance (or when `deps` change). */
  fn: () => Promise<T>;
  /** Shown while the promise is pending. Can be a VNode or component function. */
  loading: Renderable;
  /** Shown when the promise rejects. Can be a VNode or component function. */
  error: Renderable;
  /**
   * Dependency array. When provided, the promise is re-run whenever any
   * dependency value changes (shallow `Object.is` comparison). Omitting
   * `deps` means the promise runs exactly once per component instance.
   */
  deps?: unknown[];
}

type PromiseHookState<T> =
  | { status: 'idle'; gen: number }
  | { status: 'pending'; gen: number; deps: unknown[] | undefined }
  | { status: 'resolved'; data: T; gen: number; deps: unknown[] | undefined }
  | { status: 'rejected'; reason: unknown; gen: number; deps: unknown[] | undefined };

/** Returns true when the dependency arrays differ. */
function depsChanged(prev: unknown[] | undefined, next: unknown[] | undefined): boolean {
  if (next === undefined) return false; // no deps = run once, never re-run
  if (prev === undefined) return true; // deps just introduced
  if (prev.length !== next.length) return true;
  return prev.some((v, i) => !Object.is(v, next[i]));
}

/** Normalise a Renderable to a `Child` value the renderer can process. */
function toChild(renderable: Renderable): Child {
  if (renderable == null) return null;
  if (typeof renderable === 'function') {
    // Wrap a component function into a VNode so the renderer can mount it
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
 * When `deps` is provided the promise is re-run whenever any dependency
 * value changes (useful for re-fetching when an ID or search term changes).
 *
 * Must be called with `yield*` inside a generator component.
 *
 * @example
 * function* UserProfile({ userId }: { userId: number }) {
 *   const user = yield* usePromise({
 *     fn: () => fetchUser(userId),
 *     loading: <Spinner />,
 *     error: <ErrorMessage />,
 *     deps: [userId],
 *   });
 *   return <div>{user.name}</div>;
 * }
 */
export function* usePromise<T>(options: UsePromiseOptions<T>): Generator<Child, T, unknown> {
  const resume = _currentResume!;
  const states = _hookStates!;
  const index = _hookIndex++;

  if (!(index in states)) {
    states[index] = { status: 'idle', gen: 0 } as PromiseHookState<T>;
  }

  const state = states[index] as PromiseHookState<T>;

  // Reset to idle when deps have changed so the promise is re-run.
  if (state.status !== 'idle' && depsChanged(state.deps, options.deps)) {
    states[index] = { status: 'idle', gen: state.gen } as PromiseHookState<T>;
  }

  if ((states[index] as PromiseHookState<T>).status === 'idle') {
    const idleState = states[index] as { status: 'idle'; gen: number };
    const currentGen = idleState.gen + 1;
    const promise = options.fn();
    states[index] = {
      status: 'pending',
      gen: currentGen,
      deps: options.deps,
    } as PromiseHookState<T>;
    promise
      .then((data: T) => {
        const s = states[index] as PromiseHookState<T>;
        if (s.status === 'pending' && s.gen === currentGen) {
          states[index] = {
            status: 'resolved',
            data,
            gen: currentGen,
            deps: options.deps,
          } as PromiseHookState<T>;
          resume();
        }
      })
      .catch((reason: unknown) => {
        const s = states[index] as PromiseHookState<T>;
        if (s.status === 'pending' && s.gen === currentGen) {
          states[index] = {
            status: 'rejected',
            reason,
            gen: currentGen,
            deps: options.deps,
          } as PromiseHookState<T>;
          resume();
        }
      });
  }

  // Yield the loading VNode on each resume while the promise is still pending.
  // The generator is paused here until resume() is called (by the .then callback).
  while ((states[index] as PromiseHookState<T>).status === 'pending') {
    yield toChild(options.loading);
  }

  // Yield the error VNode on each resume while in the rejected state.
  // The generator stays paused indefinitely (no retry mechanism by default).
  while ((states[index] as PromiseHookState<T>).status === 'rejected') {
    yield toChild(options.error);
  }

  // State must be 'resolved' now – return the data to the component.
  return (states[index] as { status: 'resolved'; data: T }).data;
}
