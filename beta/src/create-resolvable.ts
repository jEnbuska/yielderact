/**
 * Create a Promise with externally-accessible resolve/reject functions.
 */
export function createResolvable<T = void>(): PromiseWithResolvers<T> {
  return Promise.withResolvers<T>();
}
