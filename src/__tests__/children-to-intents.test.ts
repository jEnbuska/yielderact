import { describe, expect, it } from "vitest";
import { childrenToIntents } from "../slots/intent";

function texts(children: Parameters<typeof childrenToIntents>[0]): Array<string | undefined> {
  return [...childrenToIntents(children, "").values()].map(
    (intent) => (intent as { text?: string }).text,
  );
}

describe("childrenToIntents", () => {
  describe("falsy children", () => {
    it("renders nothing for boolean children", () => {
      expect(texts([false, true])).toEqual(["", ""]);
    });

    it("renders nothing for null and undefined children", () => {
      expect(texts([null, undefined])).toEqual(["", ""]);
    });

    it("still renders 0 and empty string, which are not skipped", () => {
      expect(texts([0, ""])).toEqual(["0", ""]);
    });

    it("keeps positions stable when a conditional child is false", () => {
      expect(texts(["a", false, "b"])).toEqual(["a", "", "b"]);
    });
  });
});
