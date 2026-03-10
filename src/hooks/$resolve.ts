import type { AnyComponentFn, Child } from "../jsx";
import {
  $RESOLVE,
  $RESOLVE_RAW,
  type DependencyList,
  depsChanged,
  type HookContext,
} from "./symbols";

/**
 * A value that can be rendered: a VNode-like child, a component function,
 * or null/undefined (renders nothing).
 */
export type Renderable = Child | AnyComponentFn;

/** Options accepted by `$resolve`. */
export interface UseResolveOptions<T> {
  /**
   * A factory that creates the promise. Called once per component instance (or when `deps` change).
   * The provided `AbortSignal` is aborted when `deps` change or the component unmounts — pass it
   * to `fetch` or any other cancellable API to avoid stale responses.
   */
  fn: (signal: AbortSignal) => Promise<T>;
  /** Shown while the promise is pending. Can be a VNode or component function. */
  loading: Renderable;
  /** Shown when the promise rejects. Can be a VNode or component function. */
  error: Renderable;
}

/**
 * The return type of `$resolveRaw`.
 * A discriminated union — narrow on `loading` or `error` to access `data`.
 */
export type ResolveRawResult<T, E = unknown> =
  | { data: T; loading: false; error: undefined }
  | { data: undefined; loading: true; error: undefined }
  | { data: undefined; loading: false; error: E };

/** Normalise a Renderable to a `Child` value the renderer can process. */
function toChild(renderable: Renderable): Child {
  if (renderable == null) return null;
  if (typeof renderable === "function") {
    return { type: renderable as AnyComponentFn, props: {}, children: [] };
  }
  return renderable as Child;
}

/**
 * Low-level async state hook for generator components.
 *
 * Takes a `Promise<T>` and returns the current state as a snapshot.
 * When the promise settles the component is re-rendered and the hook
 * returns updated values.
 *
 * Unlike `$resolve`, this hook does **not** pause rendering — the
 * component receives the state immediately and decides how to render it.
 * Combine with `$memo` to memoize the promise factory:
 *
 * @example
 * function* UserProfile({ userId }: { userId: number }) {
 *   const promise = yield* $memo(() => fetchUser(userId), [userId]);
 *   const { data, loading, error } = yield* $resolveRaw<User, Error>(promise);
 *   if (loading) return <Spinner />;
 *   if (error) return <ErrorMessage message={error.message} />;
 *   return <div>{data.name}</div>;
 * }
 */
export function* $resolveRaw<T, E = unknown>(
  promise: Promise<T>,
): Generator<unknown, ResolveRawResult<T, E>, unknown> {
  const result = yield { type: $RESOLVE_RAW, promise };
  return result as ResolveRawResult<T, E>;
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
 *   const user = yield* $resolve({
 *     fn: () => fetchUser(userId),
 *     loading: <Spinner />,
 *     error: <ErrorMessage />,
 *   }, [userId]);
 *   return <div>{user.name}</div>;
 * }
 */
export function* $resolve<T>(
  options: UseResolveOptions<T>,
  deps: DependencyList,
): Generator<unknown, T, unknown> {
  // $RESOLVE handles both memoization and AbortController lifecycle.
  // The renderer creates a new AbortController on first call or when deps change,
  // passes its signal to fn, and aborts the previous controller automatically.
  const promise = (yield { type: $RESOLVE, fn: options.fn, deps }) as Promise<T>;
  const { data, loading, error } = yield* $resolveRaw<T, unknown>(promise);

  if (loading) {
    yield toChild(options.loading);
  }

  if (error !== undefined) {
    yield toChild(options.error);
  }

  return data as T;
}

/** @internal */
export function _processResolveRaw(
  descriptor: { [key: string]: unknown },
  ctx: HookContext,
): unknown {
  const { hookIndex, hookStates, rerender } = ctx;
  const promise = descriptor["promise"] as Promise<unknown>;
  const existing = hookStates[hookIndex];

  if (existing === undefined || existing.kind !== "resolve-raw" || existing.promise !== promise) {
    const state: import("../render/types").ResolveRawHookState = {
      kind: "resolve-raw",
      promise,
      status: "pending",
    };
    hookStates[hookIndex] = state;
    promise.then(
      (data) => {
        if (hookStates[hookIndex] === state) {
          hookStates[hookIndex] = { kind: "resolve-raw", promise, status: "resolved", data };
          rerender();
        }
      },
      (error: unknown) => {
        if (hookStates[hookIndex] === state) {
          hookStates[hookIndex] = { kind: "resolve-raw", promise, status: "rejected", error };
          rerender();
        }
      },
    );
  }

  const s = hookStates[hookIndex];
  if (s !== undefined && s.kind === "resolve-raw") {
    if (s.status === "resolved")
      return { data: s.data, loading: false, error: undefined } satisfies ResolveRawResult<unknown>;
    if (s.status === "rejected")
      return {
        data: undefined,
        loading: false,
        error: s.error,
      } satisfies ResolveRawResult<unknown>;
  }
  return { data: undefined, loading: true, error: undefined } satisfies ResolveRawResult<unknown>;
}

/** @internal */
export function _processResolve(descriptor: { [key: string]: unknown }, ctx: HookContext): unknown {
  const { hookIndex, hookStates, cleanupFns } = ctx;
  const fn = descriptor["fn"] as (signal: AbortSignal) => Promise<unknown>;
  const deps = descriptor["deps"] as DependencyList;
  const existing = hookStates[hookIndex];

  if (existing === undefined || existing.kind !== "resolve" || depsChanged(existing.deps, deps)) {
    if (existing !== undefined && existing.kind === "resolve") {
      existing.controller.abort();
    }
    const controller = new AbortController();
    const promise = fn(controller.signal);
    hookStates[hookIndex] = { kind: "resolve", deps, promise, controller };
    cleanupFns[hookIndex] = () => controller.abort();
    return promise;
  }
  return existing.promise;
}
