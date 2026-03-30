/**
 * Create a Promise with externally-accessible resolve/reject functions.
 *
 * Uses native `Promise.withResolvers` when available, otherwise falls
 * back to a manual implementation.
 */
export function createResolvable<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  if (typeof Promise.withResolvers === "function") {
    return Promise.withResolvers<T>();
  }
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
