export function stage<TArgs extends any[], TReturn>(
  cb: (...args: TArgs) => TReturn,
  ...args: TArgs
) {
  return (): TReturn => {
    return cb(...args);
  };
}
