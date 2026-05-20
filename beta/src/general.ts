export function stage<TArgs extends any[], TReturn>(
  cb: (...args: TArgs) => TReturn,
  ...args: TArgs
) {
  return (): TReturn => {
    return cb(...args);
  };
}
const _valuesReversed = new WeakMap<Map<string, any>, any[]>();

export function getValuesReversed<T>(map: Map<any, T>): T[] {
  return _valuesReversed.getOrInsertComputed(map, valuesReversed);
}

function valuesReversed<T>(map: Map<string, T>) {
  return Array.from(map.values()).reverse();
}

export const emptyMap = new Map<string, any>();
