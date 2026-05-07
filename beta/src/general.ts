export function invoke(cb: () => any) {
  cb();
}

export function stageInvokeAll(cbs: Array<() => any>) {
  return () => cbs.forEach(invoke);
}

export function stage<TArgs extends any[], TReturn>(
  cb: (...args: TArgs) => TReturn,
  ...args: TArgs
) {
  return (): TReturn => {
    return cb(...args);
  };
}
