import type { Child, IterableChild } from "./jsx";

class MultiIterable<T> {
  private done = false;
  private values: T[] = [];
  private iterator: Iterator<T>;

  constructor(iterable: Iterable<T>) {
    this.iterator = iterable[Symbol.iterator]();
  }

  [Symbol.iterator](): Iterator<T, void, void> {
    const { iterator, values, done } = this;
    if (done) return this.values[Symbol.iterator]();
    let index = -1;
    const setDone = () => {
      this.done = true;
    };
    return {
      next(): IteratorResult<T, void> {
        if (values.length > ++index) {
          return {
            value: values[index]!,
            done: false,
          };
        }
        const result = iterator.next();
        if (result.done) {
          setDone();
          return {
            done: true,
            value: undefined,
          };
        }
        values.push(result.value);
        return {
          value: result.value,
          done: false,
        };
      },
    };
  }
}

const iterableMap = new WeakMap<IterableChild, MultiIterable<Child>>();

export function getIterable(children: IterableChild): Iterable<Child> {
  if (Array.isArray(children)) return children;
  return iterableMap.getOrInsertComputed(children, () => new MultiIterable(children));
}
