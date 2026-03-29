/**
 * tree-set.ts — Generic sorted set backed by a sorted array.
 *
 * Items are inserted in sorted order based on a comparator function.
 * `next()` returns and removes the smallest item (first in order).
 *
 * Used by the scheduler as a WorkQueue to process components in
 * tree order (parents before children).
 */

/**
 * A sorted set that maintains items in order defined by a comparator.
 *
 * @example
 * const set = new TreeSet<{ slotId: number[]; gen: Generator }>((a, b) =>
 *   compareSlotId(a.slotId, b.slotId),
 * );
 * set.add({ slotId: [0], gen: myGen });
 * const item = set.next(); // smallest item
 */
export class TreeSet<T> {
  private readonly items: T[] = [];
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  /** Insert an item in sorted position. */
  add(item: T): void {
    const index = this.findInsertIndex(item);
    this.items.splice(index, 0, item);
  }

  /** Remove and return the smallest item, or `undefined` if empty. */
  next(): T | undefined {
    return this.items.shift();
  }

  /** Returns `true` when the set has no items. */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Remove the first item that matches the predicate. */
  removeWhere(predicate: (item: T) => boolean): boolean {
    const index = this.items.findIndex(predicate);
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }

  /** Number of items in the set. */
  get size(): number {
    return this.items.length;
  }

  /** Find the insertion index using binary search. */
  private findInsertIndex(item: T): number {
    let low = 0;
    let high = this.items.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.compare(this.items[mid] as T, item) < 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }
}
