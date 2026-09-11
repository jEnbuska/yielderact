import type { ComponentFiber } from "../instances/component-fiber";
import type { LoadState } from "../render/types";
import type { LoadDescriptor } from "./types";

import { $LOAD } from "./constants";

export function* useLoad<TData, TError = any>(
  promise: Promise<TData> | undefined,
): Generator<
  LoadDescriptor,
  Pick<LoadState<TData, TError>, "loading" | "error" | "data">,
  LoadState<TData, TError>
> {
  const descriptor: LoadDescriptor = { type: $LOAD, promise };
  const { data, loading, error } = (yield descriptor) as LoadState<TData, TError>;
  return { data, loading, error };
}

const resolved = new WeakMap<Promise<unknown>, { data: any; error: any }>();
const pending = new WeakMap<Promise<unknown>, boolean>();
export function processLoad(
  instance: ComponentFiber,
  descriptor: LoadDescriptor,
  prev?: LoadState<any>,
): LoadState<any> {
  const { promise } = descriptor;
  const state: LoadState<any> = prev ?? {
    type: $LOAD,
    loading: false,
    identifier: Symbol("RESOLVED"),
    promise,
  };
  if (!promise) {
    state.loading = false;
    state.data = undefined;
    state.error = undefined;
  } else if (resolved.has(promise)) {
    const { error, data } = resolved.get(promise)!;
    state.error = error;
    state.data = data;
    state.loading = false;
  } else if (!pending.get(promise)) {
    pending.set(promise, true);
    state.loading = true;
    state.data = undefined;
    state.error = undefined;
    void handleResolveLoad(promise, descriptor, state, instance);
  } else {
    state.loading = true;
    state.data = undefined;
    state.error = undefined;
    void handleAwaitLoad(promise, descriptor, state, instance);
  }
  return state;
}

async function handleResolveLoad(
  promise: Promise<unknown>,
  descriptor: LoadDescriptor,
  state: LoadState<any>,
  instance: ComponentFiber,
) {
  try {
    const data = await promise;
    resolved.set(promise, { data, error: undefined });
  } catch (error: any) {
    resolved.set(promise, { data: undefined, error });
  } finally {
    if (state.promise === descriptor.promise) {
      instance.unscheduleRender(state.identifier);
    }
  }
}

async function handleAwaitLoad(
  promise: Promise<unknown>,
  descriptor: LoadDescriptor,
  state: LoadState<any>,
  instance: ComponentFiber,
) {
  try {
    await promise;
  } finally {
    if (state.promise === descriptor.promise) {
      instance.unscheduleRender(state.identifier);
    }
  }
}
