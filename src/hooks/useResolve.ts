import type { Child, Component } from "../jsx";
import { isComponentRenderable } from "../render/helpers";
import type { ResolveHookState, ResolveRawHookState } from "../render/types";
import {
  $USE_RESOLVE,
  $USE_RESOLVE_RAW,
  type ResolveDescriptor,
  type ResolveRawDescriptor,
} from "./descriptors";
import type { ComponentGenerator, DependencyList } from "./types";
import { depsChanged } from "./types";

/**
 * A value that can be rendered: a VNode-like child, a component function,
 * or null/undefined (renders nothing).
 */
export type Renderable = Child | Component;

/** Options accepted by `useResolve`. */
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
 * The return type of `useResolveRaw`.
 * A discriminated union — narrow on `loading` or `error` to access `data`.
 */
export type ResolveRawResult<T, E = unknown> =
  | { data: T; loading: false; error: undefined }
  | { data: undefined; loading: true; error: undefined }
  | { data: undefined; loading: false; error: E };

/** Normalise a Renderable to a `Child` value the renderer can process. */
function toChild(renderable: Renderable): Child {
  if (renderable == null) return null;
  if (isComponentRenderable(renderable)) {
    return { type: renderable, props: {}, children: [] };
  }
  return renderable;
}

/**
 * Low-level async state hook for components.
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
): ComponentGenerator<ResolveRawResult<T, E>> {
  const desc: ResolveRawDescriptor = { type: $USE_RESOLVE_RAW, promise };
  const result = yield desc;
  return result as ResolveRawResult<T, E>;
}

/**
 * Async data hook for components.
 *
 * Pauses rendering (yields a loading VNode) until the promise resolves.
 * If the promise rejects, the error VNode is shown indefinitely.
 * Once resolved the hook returns the data and the component continues.
 *
 * The `deps` array is required. The promise is re-run whenever any dependency
 * value changes (useful for re-fetching when an ID or search term changes).
 * Pass an empty array `[]` to run the promise exactly once per component instance.
 *
 * Must be called with `yield*` inside a component.
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
  deps: DependencyList,
): ComponentGenerator<T> {
  // useResolve handles both memoization and AbortController lifecycle.
  // The renderer creates a new AbortController on first call or when deps change,
  // passes its signal to fn, and aborts the previous controller automatically.
  const desc: ResolveDescriptor = { type: $USE_RESOLVE, fn: options.fn, deps };
  const promise = (yield desc) as Promise<T>;
  const { data, loading, error } = yield* useResolveRaw<T, unknown>(promise);

  if (loading) {
    yield toChild(options.loading);
  }

  if (error !== undefined) {
    yield toChild(options.error);
  }

  return data as T;
}

/** @internal */
export function processResolveRaw(
  descriptor: ResolveRawDescriptor,
  prev?: ResolveRawHookState,
): { state: ResolveRawHookState; isNew: boolean } {
  if (prev !== undefined && prev.promise === descriptor.promise) {
    return { state: prev, isNew: false };
  }
  return {
    state: { kind: $USE_RESOLVE_RAW, promise: descriptor.promise, status: "pending" },
    isNew: true,
  };
}

/** @internal */
export function processResolve(
  descriptor: ResolveDescriptor,
  prev?: ResolveHookState,
): { state: ResolveHookState; isNew: boolean } {
  if (prev !== undefined && !depsChanged(prev.deps, descriptor.deps)) {
    return { state: prev, isNew: false };
  }
  if (prev !== undefined) {
    prev.controller.abort();
  }
  const controller = new AbortController();
  const promise = descriptor.fn(controller.signal);
  return {
    state: { kind: $USE_RESOLVE, deps: descriptor.deps, promise, controller },
    isNew: true,
  };
}
