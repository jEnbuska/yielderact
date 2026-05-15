export function deriveStableIndexes<Slot extends { index: number }>(
  drafts: Map<string, any>,
  prevSlots: Map<string, Slot>,
): Set<number> {
  const tailPos: number[] = []; // tailPos[k] = old slot index of the smallest tail of an LIS of length k+1
  const prev: Array<number | undefined> = new Array(prevSlots.size);

  for (const key of drafts.keys()) {
    const slot = prevSlots.get(key);
    if (slot === undefined) continue;
    const x = slot.index;

    let lo = 0;
    let hi = tailPos.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tailPos[mid]! < x) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[x] = tailPos[lo - 1]!;
    tailPos[lo] = x;
  }

  const result = new Set<number>();
  let k: number | undefined = tailPos[tailPos.length - 1];
  while (k !== undefined) {
    result.add(k);
    k = prev[k];
  }
  return result;
}
