export function stage<TArgs extends any[], TReturn>(
  cb: (...args: TArgs) => TReturn,
  ...args: TArgs
) {
  return (): TReturn => {
    return cb(...args);
  };
}

const _values = new WeakMap<ReadonlyMap<any, any>, any[]>();
const _valuesReversed = new WeakMap<ReadonlyMap<any, any>, any[]>();

export function getMapValuesReversed<T>(map: ReadonlyMap<any, T>): T[] {
  return _valuesReversed.getOrInsertComputed(map, mapValuesReversed);
}

function mapValuesReversed<T>(map: ReadonlyMap<any, T>) {
  return getMapValues(map).toReversed();
}

export function getMapValues<T>(map: ReadonlyMap<any, T>): T[] {
  return _values.getOrInsertComputed(map, mapValues);
}

function mapValues<T>(map: ReadonlyMap<string, T>) {
  return [...map.values()];
}

export const emptyMap: ReadonlyMap<any, any> = new Map<any, any>();
