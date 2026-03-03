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
let _hookStates: unknown[] | null = null;
let _hookIndex = 0;

/**
 * Called by the renderer before executing a fresh generator body.
 * Sets the module-level hook context so hooks can read/write persistent state.
 *
 * @internal
 */
export function _initHooks(rerender: () => void, states: unknown[]): void {
  _currentRerender = rerender;
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
export function* useState<T>(
  initialValue: T
): Generator<never, [T, (value: T) => void], unknown> {
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
// usePromise
// ---------------------------------------------------------------------------

/**
 * A value that can be rendered: a VNode-like child, a component function,
 * or null/undefined (renders nothing).
 */
export type Renderable = Child | AnyComponentFn;

/** Options accepted by `usePromise`. */
export interface UsePromiseOptions<T> {
  /** A factory that creates the promise. Called once per component instance. */
  fn: () => Promise<T>;
  /** Shown while the promise is pending. Can be a VNode or component function. */
  loading: Renderable;
  /** Shown when the promise rejects. Can be a VNode or component function. */
  error: Renderable;
}

type PromiseHookState<T> =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'resolved'; data: T }
  | { status: 'rejected'; reason: unknown };

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
 * Must be called with `yield*` inside a generator component.
 *
 * @example
 * function* UserProfile(_props: object) {
 *   const user = yield* usePromise({
 *     fn: () => fetchUser(1),
 *     loading: <Spinner />,
 *     error: <ErrorMessage />,
 *   });
 *   return <div>{user.name}</div>;
 * }
 */
export function* usePromise<T>(
  options: UsePromiseOptions<T>
): Generator<Child, T, unknown> {
  const rerender = _currentRerender!;
  const states = _hookStates!;
  const index = _hookIndex++;

  if (!(index in states)) {
    states[index] = { status: 'idle' } as PromiseHookState<T>;
  }

  if ((states[index] as PromiseHookState<T>).status === 'idle') {
    const promise = options.fn();
    states[index] = { status: 'pending' } as PromiseHookState<T>;
    promise.then((data: T) => {
      states[index] = { status: 'resolved', data } as PromiseHookState<T>;
      rerender();
    }).catch((reason: unknown) => {
      states[index] = { status: 'rejected', reason } as PromiseHookState<T>;
      rerender();
    });
  }

  // Yield the loading VNode on each resume while the promise is still pending.
  // The generator is paused here until rerender() is called (by the .then callback).
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
