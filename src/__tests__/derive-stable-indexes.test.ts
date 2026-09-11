import { describe, expect, it } from "vitest";
import { deriveStableIndexes } from "../reconciler/derive-stable-indexes";

/**
 * Tests for `deriveStableIndexes`.
 *
 * Contract recap:
 *   - Input: `drafts` (new render's intents, iterated in new-order),
 *     `oldSlots` (previous render's slots, keyed by the same string keys).
 *   - Output: a Set of *previous-render slot indices* that participate in
 *     the Longest Increasing Subsequence of "survivors' old indices in
 *     new order". Survivors whose old index is in the set are in a
 *     stable relative position and don't need a DOM move.
 *
 * Test inputs are constructed as the minimum needed to exercise the
 * algorithm: drafts only need a key in the map, prev slots only need an
 * `index` field. The function's generic signature accepts any value
 * shape for prev slots as long as `index` is present, so the tests use
 * trivial stub shapes instead of full Slot/DraftIntent objects.
 *
 * Naming convention for these tests: a "swap of a and b" means the keys
 * for a and b appear in opposite order in the new render vs. the old.
 * The LIS picks the *minimum* set of moves, which for a pure swap is
 * always one element (either a or b), never both — moving either one
 * suffices to produce the desired DOM order.
 */

// ── Test helpers ──────────────────────────────────────────────────────────

/**
 * The minimal shape of an entry in `oldSlots` that the function
 * actually reads — just `.index`. The function's type signature uses a
 * generic `T extends { index: number }`, so this is the structurally
 * minimal type that satisfies it.
 */
type StubSlot = { index: number };

/**
 * Build a `drafts` map keyed by string, in iteration order matching the
 * argument. The function only iterates `drafts.keys()`, so the value
 * shape is irrelevant — anything will do.
 */
function makeDrafts(keys: string[]): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (let i = 0; i < keys.length; i++) {
    m.set(keys[i]!, { index: i });
  }
  return m;
}

/**
 * Build a `oldSlots` map keyed by string. Each entry carries the index
 * the slot occupied in the previous render — the position in the
 * argument array.
 */
function makePrevSlots(keys: string[]): Map<string, StubSlot> {
  const m = new Map<string, StubSlot>();
  for (let i = 0; i < keys.length; i++) {
    m.set(keys[i]!, { index: i });
  }
  return m;
}

// ── Empty / trivial inputs ────────────────────────────────────────────────

describe("deriveStableIndexes — trivial inputs", () => {
  it("returns an empty set when there are no drafts", () => {
    const result = deriveStableIndexes(makeDrafts([]), makePrevSlots(["a", "b"]));
    expect(result).toEqual(new Set());
  });

  it("returns an empty set when there are no prev slots", () => {
    const result = deriveStableIndexes(makeDrafts(["a", "b", "c"]), makePrevSlots([]));
    expect(result).toEqual(new Set());
  });

  it("returns an empty set when no draft keys overlap with prev slots", () => {
    const result = deriveStableIndexes(makeDrafts(["x", "y", "z"]), makePrevSlots(["a", "b", "c"]));
    expect(result).toEqual(new Set());
  });

  it("returns the single old index when one draft matches one prev slot", () => {
    const result = deriveStableIndexes(makeDrafts(["a"]), makePrevSlots(["a"]));
    expect(result).toEqual(new Set([0]));
  });
});

// ── Identity (no reordering) ──────────────────────────────────────────────

describe("deriveStableIndexes — identity (no reordering)", () => {
  it("marks every slot stable when drafts arrive in the same order as prev", () => {
    const result = deriveStableIndexes(makeDrafts(["a", "b", "c"]), makePrevSlots(["a", "b", "c"]));
    expect(result).toEqual(new Set([0, 1, 2]));
  });

  it("marks every slot stable for a single-element identity render", () => {
    const result = deriveStableIndexes(makeDrafts(["a"]), makePrevSlots(["a"]));
    expect(result).toEqual(new Set([0]));
  });

  it("marks every slot stable for a long identity render", () => {
    const keys = Array.from({ length: 10 }, (_, i) => `k${i}`);
    const result = deriveStableIndexes(makeDrafts(keys), makePrevSlots(keys));
    expect(result).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });
});

// ── Pure swaps ────────────────────────────────────────────────────────────

describe("deriveStableIndexes — pure swaps (no inserts or removes)", () => {
  it("swapping two adjacent slots yields exactly one stable slot", () => {
    // old: [a, b], new: [b, a]
    // LIS of [1, 0] has length 1. Either {0} or {1} would be optimal.
    // The algorithm picks based on the binary-search tie-break — verify
    // the result has the correct *size*, not the specific element.
    const result = deriveStableIndexes(makeDrafts(["b", "a"]), makePrevSlots(["a", "b"]));
    expect(result.size).toBe(1);
    expect([...result].every((i) => i === 0 || i === 1)).toBe(true);
  });

  it("swapping two adjacent in a three-element list keeps the third stable", () => {
    // old: [a, b, c], new: [b, a, c]
    // LIS over [1, 0, 2] is length 2 (e.g. {0, 2} or {1, 2}); c is always stable.
    const result = deriveStableIndexes(makeDrafts(["b", "a", "c"]), makePrevSlots(["a", "b", "c"]));
    expect(result.size).toBe(2);
    expect(result.has(2)).toBe(true); // c is always in the stable set
  });

  it("full reversal of three picks exactly one stable slot", () => {
    // old: [a, b, c], new: [c, b, a]
    // LIS over [2, 1, 0] is length 1. Any single element is a valid LIS;
    // the binary-search tie-break determines which one. Only assert the
    // size — the specific choice is an implementation detail.
    const result = deriveStableIndexes(makeDrafts(["c", "b", "a"]), makePrevSlots(["a", "b", "c"]));
    expect(result.size).toBe(1);
  });

  it("full reversal of four keeps exactly one stable", () => {
    // old: [a, b, c, d], new: [d, c, b, a]
    // LIS over [3, 2, 1, 0] is length 1.
    const result = deriveStableIndexes(
      makeDrafts(["d", "c", "b", "a"]),
      makePrevSlots(["a", "b", "c", "d"]),
    );
    expect(result.size).toBe(1);
  });

  it("rotating one element to the front yields n-1 stable slots", () => {
    // old: [a, b, c, d], new: [d, a, b, c]
    // LIS over [3, 0, 1, 2] is length 3 — {0, 1, 2} (the a,b,c subsequence).
    const result = deriveStableIndexes(
      makeDrafts(["d", "a", "b", "c"]),
      makePrevSlots(["a", "b", "c", "d"]),
    );
    expect(result).toEqual(new Set([0, 1, 2]));
  });

  it("rotating one element to the back yields n-1 stable slots", () => {
    // old: [a, b, c, d], new: [b, c, d, a]
    // LIS over [1, 2, 3, 0] is length 3 — {1, 2, 3} (the b,c,d subsequence).
    const result = deriveStableIndexes(
      makeDrafts(["b", "c", "d", "a"]),
      makePrevSlots(["a", "b", "c", "d"]),
    );
    expect(result).toEqual(new Set([1, 2, 3]));
  });
});

// ── Inserts only (no removes) ─────────────────────────────────────────────

describe("deriveStableIndexes — inserts only", () => {
  it("inserting at the front keeps all survivors stable", () => {
    // old: [a, b, c], new: [x, a, b, c]
    // x is new (not in prev), so it doesn't contribute to LIS input.
    // LIS over [0, 1, 2] (a,b,c old indices) is the full sequence.
    const result = deriveStableIndexes(
      makeDrafts(["x", "a", "b", "c"]),
      makePrevSlots(["a", "b", "c"]),
    );
    expect(result).toEqual(new Set([0, 1, 2]));
  });

  it("inserting in the middle keeps all survivors stable", () => {
    // old: [a, b, c], new: [a, x, b, c]
    const result = deriveStableIndexes(
      makeDrafts(["a", "x", "b", "c"]),
      makePrevSlots(["a", "b", "c"]),
    );
    expect(result).toEqual(new Set([0, 1, 2]));
  });

  it("inserting at the back keeps all survivors stable", () => {
    // old: [a, b, c], new: [a, b, c, x]
    const result = deriveStableIndexes(
      makeDrafts(["a", "b", "c", "x"]),
      makePrevSlots(["a", "b", "c"]),
    );
    expect(result).toEqual(new Set([0, 1, 2]));
  });

  it("multiple inserts scattered through survivors keep all survivors stable", () => {
    // old: [a, b, c], new: [x, a, y, b, z, c, w]
    const result = deriveStableIndexes(
      makeDrafts(["x", "a", "y", "b", "z", "c", "w"]),
      makePrevSlots(["a", "b", "c"]),
    );
    expect(result).toEqual(new Set([0, 1, 2]));
  });
});

// ── Removes only (no inserts, no reorders) ────────────────────────────────

describe("deriveStableIndexes — removes only", () => {
  it("removing from the front keeps remaining survivors stable", () => {
    // old: [a, b, c], new: [b, c]
    // LIS over [1, 2] is the full sequence.
    const result = deriveStableIndexes(makeDrafts(["b", "c"]), makePrevSlots(["a", "b", "c"]));
    expect(result).toEqual(new Set([1, 2]));
  });

  it("removing from the middle keeps remaining survivors stable", () => {
    // old: [a, b, c], new: [a, c]
    // LIS over [0, 2] is the full sequence.
    const result = deriveStableIndexes(makeDrafts(["a", "c"]), makePrevSlots(["a", "b", "c"]));
    expect(result).toEqual(new Set([0, 2]));
  });

  it("removing from the back keeps remaining survivors stable", () => {
    // old: [a, b, c], new: [a, b]
    const result = deriveStableIndexes(makeDrafts(["a", "b"]), makePrevSlots(["a", "b", "c"]));
    expect(result).toEqual(new Set([0, 1]));
  });

  it("removing all but one keeps the survivor stable regardless of position", () => {
    // old: [a, b, c, d, e], new: [c]
    const result = deriveStableIndexes(makeDrafts(["c"]), makePrevSlots(["a", "b", "c", "d", "e"]));
    expect(result).toEqual(new Set([2]));
  });
});

// ── Mixed inserts, removes, reorders ──────────────────────────────────────

describe("deriveStableIndexes — mixed inserts, removes, and reorders", () => {
  it("removing two and swapping the rest leaves the optimal stable element", () => {
    // old: [a, b, c, d], new: [c, b]   (a, d removed; b and c swapped)
    // LIS over [2, 1] is length 1.
    const result = deriveStableIndexes(makeDrafts(["c", "b"]), makePrevSlots(["a", "b", "c", "d"]));
    expect(result.size).toBe(1);
  });

  it("removing one and swapping two adjacent keeps the third stable", () => {
    // old: [a, b, c, d, e], new: [a, c, b, e]   (d removed; b and c swapped)
    // LIS over [0, 2, 1, 4] is length 3.
    const result = deriveStableIndexes(
      makeDrafts(["a", "c", "b", "e"]),
      makePrevSlots(["a", "b", "c", "d", "e"]),
    );
    expect(result.size).toBe(3);
    expect(result.has(0)).toBe(true); // a
    expect(result.has(4)).toBe(true); // e
  });

  it("inserting and reordering: insert at front + adjacent swap", () => {
    // old: [a, b, c], new: [x, b, a, c]
    // Survivors in draft order: b(1), a(0), c(2). LIS over [1, 0, 2] length 2.
    const result = deriveStableIndexes(
      makeDrafts(["x", "b", "a", "c"]),
      makePrevSlots(["a", "b", "c"]),
    );
    expect(result.size).toBe(2);
    expect(result.has(2)).toBe(true); // c stable
  });

  it("complex case: inserts, removes, and a full reversal of remaining", () => {
    // old: [a, b, c, d, e], new: [x, e, c, a, y]
    // Survivors in draft order: e(4), c(2), a(0). LIS over [4, 2, 0] is length 1.
    const result = deriveStableIndexes(
      makeDrafts(["x", "e", "c", "a", "y"]),
      makePrevSlots(["a", "b", "c", "d", "e"]),
    );
    expect(result.size).toBe(1);
  });

  it("interleaved survivors stay stable when they remain in relative order", () => {
    // old: [a, b, c, d, e], new: [x, a, y, c, z, e, w]
    // Survivors a(0), c(2), e(4) in relative order — full LIS.
    const result = deriveStableIndexes(
      makeDrafts(["x", "a", "y", "c", "z", "e", "w"]),
      makePrevSlots(["a", "b", "c", "d", "e"]),
    );
    expect(result).toEqual(new Set([0, 2, 4]));
  });
});

// ── LIS correctness on tricky integer sequences ───────────────────────────

describe("deriveStableIndexes — LIS correctness on tricky sequences", () => {
  /**
   * These tests use synthetic key names that encode the old index, so the
   * input to the LIS is exactly the named integer sequence. Use them to
   * verify the LIS computation against known classical results.
   */

  function runLisCase(prevOrder: string[], newOrder: string[]) {
    return deriveStableIndexes(makeDrafts(newOrder), makePrevSlots(prevOrder));
  }

  it("matches classical LIS for [2, 0, 1] → length 2", () => {
    // Optimal LIS: {0, 1} (the 0→1 subseq in the input).
    const result = runLisCase(["k0", "k1", "k2"], ["k2", "k0", "k1"]);
    expect(result.size).toBe(2);
    expect(result.has(0)).toBe(true);
    expect(result.has(1)).toBe(true);
  });

  it("matches classical LIS for [1, 3, 0, 2] → length 2", () => {
    // Optimal LIS: length 2. Valid LISes: {1,3}, {1,2}, {0,2}.
    const result = runLisCase(["k0", "k1", "k2", "k3"], ["k1", "k3", "k0", "k2"]);
    expect(result.size).toBe(2);
  });

  it("matches classical LIS for [3, 1, 4, 1, 5, 9, 2, 6] (deduplicated) → length 4", () => {
    // We can't have duplicates in old indices, so pick distinct subset.
    // Sequence: [3, 1, 4, 5, 9, 2, 6]. LIS length 4 (e.g. 1, 4, 5, 9 → {1,4,5,9}).
    const prev = ["k0", "k1", "k2", "k3", "k4", "k5", "k6", "k7", "k8", "k9"];
    const result = runLisCase(prev, ["k3", "k1", "k4", "k5", "k9", "k2", "k6"]);
    expect(result.size).toBe(4);
  });

  it("strictly decreasing input has LIS of length 1", () => {
    const prev = ["k0", "k1", "k2", "k3", "k4"];
    const newOrder = ["k4", "k3", "k2", "k1", "k0"];
    const result = runLisCase(prev, newOrder);
    expect(result.size).toBe(1);
  });

  it("strictly increasing input has LIS of full length", () => {
    const prev = ["k0", "k1", "k2", "k3", "k4"];
    const newOrder = ["k0", "k1", "k2", "k3", "k4"];
    const result = runLisCase(prev, newOrder);
    expect(result).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it("preserves stable elements that bracket a moved one", () => {
    // old: [a, b, c, d, e], new: [a, b, e, c, d]
    // Survivors all present. Indices in draft order: [0, 1, 4, 2, 3].
    // LIS: e.g. {0, 1, 2, 3} (a, b, c, d kept in order) — length 4. Only e moves.
    const result = runLisCase(["a", "b", "c", "d", "e"], ["a", "b", "e", "c", "d"]);
    expect(result.size).toBe(4);
    expect(result.has(4)).toBe(false); // e is the one that moves
  });
});

// ── Property-based sanity checks ──────────────────────────────────────────

describe("deriveStableIndexes — invariants", () => {
  /**
   * For any (drafts, oldSlots) pair:
   *
   *   1. Every value in `result` must equal `oldSlots.get(key).index` for
   *      some `key` that exists in both maps.
   *   2. The size of `result` equals the length of the LIS over the
   *      sequence of "old indices of survivors in draft order".
   *   3. `result` must form a strictly increasing subsequence when iterated
   *      in the order the corresponding keys appear in `drafts`.
   */

  function survivorOldIndices(
    drafts: Map<string, unknown>,
    oldSlots: Map<string, StubSlot>,
  ): number[] {
    const out: number[] = [];
    for (const key of drafts.keys()) {
      const s = oldSlots.get(key);
      if (s !== undefined) out.push(s.index);
    }
    return out;
  }

  function classicalLisLength(arr: number[]): number {
    const tails: number[] = [];
    for (const x of arr) {
      let lo = 0;
      let hi = tails.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (tails[mid]! < x) lo = mid + 1;
        else hi = mid;
      }
      tails[lo] = x;
    }
    return tails.length;
  }

  const cases: Array<{ name: string; prev: string[]; next: string[] }> = [
    { name: "identity", prev: ["a", "b", "c"], next: ["a", "b", "c"] },
    { name: "full reversal", prev: ["a", "b", "c", "d"], next: ["d", "c", "b", "a"] },
    { name: "mixed", prev: ["a", "b", "c", "d", "e"], next: ["x", "e", "c", "a", "y"] },
    { name: "all new", prev: ["a", "b"], next: ["x", "y", "z"] },
    { name: "all removed", prev: ["a", "b"], next: [] },
    { name: "rotation", prev: ["a", "b", "c", "d"], next: ["d", "a", "b", "c"] },
  ];

  for (const { name, prev, next } of cases) {
    it(`${name}: result size equals classical LIS length`, () => {
      const drafts = makeDrafts(next);
      const oldSlots = makePrevSlots(prev);
      const result = deriveStableIndexes(drafts, oldSlots);
      const lisInput = survivorOldIndices(drafts, oldSlots);
      expect(result.size).toBe(classicalLisLength(lisInput));
    });

    it(`${name}: every result entry is a real prev slot index`, () => {
      const drafts = makeDrafts(next);
      const oldSlots = makePrevSlots(prev);
      const result = deriveStableIndexes(drafts, oldSlots);
      const validOldIndices = new Set<number>();
      for (const slot of oldSlots.values()) validOldIndices.add(slot.index);
      for (const idx of result) {
        expect(validOldIndices.has(idx)).toBe(true);
      }
    });

    it(`${name}: result entries in draft-key order are strictly increasing`, () => {
      const drafts = makeDrafts(next);
      const oldSlots = makePrevSlots(prev);
      const result = deriveStableIndexes(drafts, oldSlots);
      const ordered: number[] = [];
      for (const key of drafts.keys()) {
        const s = oldSlots.get(key);
        if (s !== undefined && result.has(s.index)) ordered.push(s.index);
      }
      for (let i = 1; i < ordered.length; i++) {
        expect(ordered[i]).toBeGreaterThan(ordered[i - 1]!);
      }
    });
  }
});

// ── Reconciler-style scenarios (named like real renders) ──────────────────

describe("deriveStableIndexes — reconciler scenarios", () => {
  it("scenario: list of three, swap first two", () => {
    // old: [a, b, c], new: [b, a, c]
    // Optimal: one of a or b moves; c stays. c (old idx 2) must be stable.
    const result = deriveStableIndexes(makeDrafts(["b", "a", "c"]), makePrevSlots(["a", "b", "c"]));
    expect(result.has(2)).toBe(true);
    expect(result.size).toBe(2);
  });

  it("scenario: remove two adjacent, third stays put", () => {
    // old: [a, b, c], new: [c]
    // c (old idx 2) is the only survivor and trivially stable.
    const result = deriveStableIndexes(makeDrafts(["c"]), makePrevSlots(["a", "b", "c"]));
    expect(result).toEqual(new Set([2]));
  });

  it("scenario: prepend an item, rest unchanged", () => {
    // old: [a, b, c], new: [x, a, b, c]
    const result = deriveStableIndexes(
      makeDrafts(["x", "a", "b", "c"]),
      makePrevSlots(["a", "b", "c"]),
    );
    expect(result).toEqual(new Set([0, 1, 2]));
  });

  it("scenario: append an item, rest unchanged", () => {
    const result = deriveStableIndexes(
      makeDrafts(["a", "b", "c", "x"]),
      makePrevSlots(["a", "b", "c"]),
    );
    expect(result).toEqual(new Set([0, 1, 2]));
  });

  it("scenario: replace middle item (remove + insert in same position)", () => {
    // old: [a, b, c], new: [a, x, c]
    // b removed, x new. Survivors a(0) and c(2) are in order — both stable.
    const result = deriveStableIndexes(makeDrafts(["a", "x", "c"]), makePrevSlots(["a", "b", "c"]));
    expect(result).toEqual(new Set([0, 2]));
  });

  it("scenario: complete replacement (no key overlap)", () => {
    const result = deriveStableIndexes(makeDrafts(["x", "y", "z"]), makePrevSlots(["a", "b", "c"]));
    expect(result).toEqual(new Set());
  });
});
