import { describe, expect, it } from "vitest";
import type { VNodeProps } from "../jsx";
import { diffElementProps } from "../render/element-props";

const props = (o: Record<string, unknown>): VNodeProps => o as VNodeProps;

describe("diffElementProps", () => {
  describe("no-op cases", () => {
    it("returns null when prev and next are the same object", () => {
      const p = props({ id: "a", className: "foo" });
      expect(diffElementProps(p, p)).toBeNull();
    });

    it("returns null when every key+value is Object.is-equal", () => {
      expect(
        diffElementProps(props({ id: "a", className: "foo" }), props({ id: "a", className: "foo" })),
      ).toBeNull();
    });

    it("ignores reserved props (key, deps, ref, shown) on both sides", () => {
      expect(
        diffElementProps(
          props({ id: "a", key: "k1", deps: [1], shown: true }),
          props({ id: "a", key: "k2", deps: [2], shown: false }),
        ),
      ).toBeNull();
    });

    it("returns null when inline style objects are structurally equal", () => {
      expect(
        diffElementProps(
          props({ style: { color: "red", padding: "4px" } }),
          props({ style: { color: "red", padding: "4px" } }),
        ),
      ).toBeNull();
    });
  });

  describe("attribute writes", () => {
    it("collects added and changed plain attrs into setAttrs", () => {
      const patch = diffElementProps(props({ id: "a" }), props({ id: "b", title: "hi" }));
      expect(patch).toEqual({ setAttrs: { id: "b", title: "hi" } });
    });

    it("collects dropped plain attrs into removeAttrs", () => {
      const patch = diffElementProps(props({ id: "a", title: "hi" }), props({ id: "a" }));
      expect(patch).toEqual({ removeAttrs: ["title"] });
    });

    it("does not include unchanged attrs", () => {
      const patch = diffElementProps(
        props({ id: "same", title: "old" }),
        props({ id: "same", title: "new" }),
      );
      expect(patch).toEqual({ setAttrs: { title: "new" } });
    });
  });

  describe("events", () => {
    it("emits setEvents for a newly added handler", () => {
      const onClick = () => {};
      const patch = diffElementProps(props({}), props({ onClick }));
      expect(patch).toEqual({ setEvents: { onClick } });
    });

    it("emits removeEvents when a handler is dropped", () => {
      const onClick = () => {};
      const patch = diffElementProps(props({ onClick }), props({}));
      expect(patch).toEqual({ removeEvents: ["onClick"] });
    });

    it("emits both remove + set when a handler is swapped", () => {
      const prevHandler = () => {};
      const nextHandler = () => {};
      const patch = diffElementProps(props({ onClick: prevHandler }), props({ onClick: nextHandler }));
      expect(patch).toEqual({
        removeEvents: ["onClick"],
        setEvents: { onClick: nextHandler },
      });
    });

    it("returns null when the same handler reference is reused", () => {
      const onClick = () => {};
      expect(diffElementProps(props({ onClick }), props({ onClick }))).toBeNull();
    });
  });

  describe("style", () => {
    it("assigns a new style object when prev had none", () => {
      const patch = diffElementProps(props({}), props({ style: { color: "red" } }));
      expect(patch).toEqual({ style: { color: "red" } });
    });

    it("sets style to null when next drops the prop entirely", () => {
      const patch = diffElementProps(props({ style: { color: "red" } }), props({}));
      expect(patch).toEqual({ style: null });
    });

    it("sets style to null when next.style is explicitly undefined (== unset)", () => {
      const patch = diffElementProps(
        props({ style: { color: "red" } }),
        props({ style: undefined }),
      );
      expect(patch).toEqual({ style: null });
    });

    it("emits only changed style keys when both sides are objects", () => {
      const patch = diffElementProps(
        props({ style: { color: "red", padding: "4px" } }),
        props({ style: { color: "blue", padding: "4px" } }),
      );
      expect(patch).toEqual({ style: { color: "blue" } });
    });

    it("emits \"\" for style keys that disappeared", () => {
      const patch = diffElementProps(
        props({ style: { color: "red", padding: "4px" } }),
        props({ style: { color: "red" } }),
      );
      expect(patch).toEqual({ style: { padding: "" } });
    });

    it("returns null for identical-but-not-same-reference style objects", () => {
      expect(
        diffElementProps(
          props({ style: { color: "red", margin: "0" } }),
          props({ style: { color: "red", margin: "0" } }),
        ),
      ).toBeNull();
    });
  });

  describe("ref", () => {
    it("records a ref swap when prev and next ref differ", () => {
      const prevRef = { current: null };
      const nextRef = { current: null };
      const patch = diffElementProps(props({ ref: prevRef }), props({ ref: nextRef }));
      expect(patch).toEqual({ refSwap: { prev: prevRef, next: nextRef } });
    });

    it("records a ref swap when only the next ref is set", () => {
      const nextRef = { current: null };
      const patch = diffElementProps(props({}), props({ ref: nextRef }));
      expect(patch).toEqual({ refSwap: { prev: undefined, next: nextRef } });
    });

    it("returns null when the same ref reference is reused", () => {
      const ref = { current: null };
      expect(diffElementProps(props({ ref }), props({ ref }))).toBeNull();
    });
  });

  describe("combined", () => {
    it("produces every bucket at once when all kinds of changes co-occur", () => {
      const prevHandler = () => {};
      const nextHandler = () => {};
      const prevRef = { current: null };
      const nextRef = { current: null };
      const patch = diffElementProps(
        props({
          id: "old",
          title: "will-drop",
          onClick: prevHandler,
          style: { color: "red", padding: "4px" },
          ref: prevRef,
        }),
        props({
          id: "new",
          "data-new": "added",
          onClick: nextHandler,
          style: { color: "red", margin: "0" },
          ref: nextRef,
        }),
      );
      expect(patch).toEqual({
        removeAttrs: ["title"],
        setAttrs: { id: "new", "data-new": "added" },
        removeEvents: ["onClick"],
        setEvents: { onClick: nextHandler },
        style: { padding: "", margin: "0" },
        refSwap: { prev: prevRef, next: nextRef },
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // New coverage after the hardening pass: unified-undefined rule, strict
  // validation, prototype safety, and the non-obvious correct-behaviour
  // invariants that should never silently drift.
  // ──────────────────────────────────────────────────────────────────────────

  describe("unified undefined semantics (attrs)", () => {
    it("treats next[key] = undefined as 'unset' and removes a set prev", () => {
      const patch = diffElementProps(
        props({ title: "hi" }),
        props({ title: undefined }),
      );
      expect(patch).toEqual({ removeAttrs: ["title"] });
    });

    it("returns null when next has explicit undefined but prev did not have the key", () => {
      expect(diffElementProps(props({}), props({ title: undefined }))).toBeNull();
    });

    it("returns null when both prev and next have undefined for a key", () => {
      expect(
        diffElementProps(props({ title: undefined }), props({ title: undefined })),
      ).toBeNull();
    });

    it("treats prev[key] = undefined as 'unset' so next[key] = value is a plain add", () => {
      const patch = diffElementProps(
        props({ title: undefined }),
        props({ title: "hi" }),
      );
      expect(patch).toEqual({ setAttrs: { title: "hi" } });
    });
  });

  describe("unified undefined semantics (events)", () => {
    it("emits removeEvents when a handler becomes undefined", () => {
      const onClick = () => {};
      const patch = diffElementProps(props({ onClick }), props({ onClick: undefined }));
      expect(patch).toEqual({ removeEvents: ["onClick"] });
    });

    it("emits setEvents when a prev-undefined handler becomes a function", () => {
      const onClick = () => {};
      const patch = diffElementProps(props({ onClick: undefined }), props({ onClick }));
      expect(patch).toEqual({ setEvents: { onClick } });
    });

    it("returns null when both prev and next have undefined for an event key", () => {
      expect(
        diffElementProps(props({ onClick: undefined }), props({ onClick: undefined })),
      ).toBeNull();
    });
  });

  describe("unified undefined semantics (style)", () => {
    it("emits \"\" when a style key becomes undefined", () => {
      const patch = diffElementProps(
        props({ style: { color: "red" } }),
        props({ style: { color: undefined } }),
      );
      expect(patch).toEqual({ style: { color: "" } });
    });

    it("returns null when a style key is undefined on both sides", () => {
      expect(
        diffElementProps(
          props({ style: { color: undefined } }),
          props({ style: { color: undefined } }),
        ),
      ).toBeNull();
    });

    it("does not emit a write for a next-style key that is undefined with no prev counterpart", () => {
      const patch = diffElementProps(
        props({ style: { padding: "4px" } }),
        props({ style: { padding: "4px", color: undefined } }),
      );
      expect(patch).toBeNull();
    });

    it("treats a prev-undefined style key as unset — next value is a plain add", () => {
      const patch = diffElementProps(
        props({ style: { color: undefined } }),
        props({ style: { color: "red" } }),
      );
      expect(patch).toEqual({ style: { color: "red" } });
    });
  });

  describe("validation throws", () => {
    it("throws when an event prop on next is a string", () => {
      expect(() =>
        diffElementProps(props({}), props({ onClick: "alert(1)" })),
      ).toThrow(/event prop "onClick"/);
    });

    it("throws when an event prop on next is a number", () => {
      expect(() => diffElementProps(props({}), props({ onClick: 42 }))).toThrow(
        /event prop "onClick"/,
      );
    });

    it("throws when an event prop on next is false", () => {
      expect(() => diffElementProps(props({}), props({ onClick: false }))).toThrow(
        /event prop "onClick"/,
      );
    });

    it("throws when an event prop on prev is a non-function and next drops it", () => {
      expect(() =>
        diffElementProps(props({ onClick: "bad" }), props({})),
      ).toThrow(/event prop "onClick"/);
    });

    it("throws when style is a string", () => {
      expect(() =>
        diffElementProps(props({}), props({ style: "color: red" })),
      ).toThrow(/"style" prop must be a plain object/);
    });

    it("throws when style is a number", () => {
      expect(() => diffElementProps(props({}), props({ style: 7 }))).toThrow(
        /"style" prop must be a plain object/,
      );
    });

    it("throws when style is an array", () => {
      expect(() =>
        diffElementProps(props({}), props({ style: [{ color: "red" }] })),
      ).toThrow(/"style" prop must be a plain object/);
    });

    it("throws when style is a boolean", () => {
      expect(() => diffElementProps(props({}), props({ style: true }))).toThrow(
        /"style" prop must be a plain object/,
      );
    });

    it("throws when style on prev is an array and next drops it", () => {
      expect(() =>
        diffElementProps(props({ style: [{ color: "red" }] }), props({})),
      ).toThrow(/"style" prop must be a plain object/);
    });
  });

  describe("event-key tightening (/^on[A-Z]/)", () => {
    it("does not route `once={fn}` through the event buckets", () => {
      const fn = () => {};
      const patch = diffElementProps(props({}), props({ once: fn }));
      expect(patch).toEqual({ setAttrs: { once: fn } });
    });

    it("does not route `online={fn}` through the event buckets", () => {
      const fn = () => {};
      const patch = diffElementProps(props({}), props({ online: fn }));
      expect(patch).toEqual({ setAttrs: { online: fn } });
    });

    it("does not route `onto={fn}` through the event buckets", () => {
      const fn = () => {};
      const patch = diffElementProps(props({}), props({ onto: fn }));
      expect(patch).toEqual({ setAttrs: { onto: fn } });
    });

    it("does not route `onset={fn}` through the event buckets", () => {
      const fn = () => {};
      const patch = diffElementProps(props({}), props({ onset: fn }));
      expect(patch).toEqual({ setAttrs: { onset: fn } });
    });

    it("does route `onClick={fn}` through the event buckets", () => {
      const fn = () => {};
      const patch = diffElementProps(props({}), props({ onClick: fn }));
      expect(patch).toEqual({ setEvents: { onClick: fn } });
    });
  });

  describe("prototype-chain safety", () => {
    it("ignores enumerable keys inherited from next's prototype", () => {
      const proto = { inheritedTitle: "ghost" };
      const next = Object.create(proto) as Record<string, unknown>;
      next["id"] = "a";
      const patch = diffElementProps(props({}), next as VNodeProps);
      expect(patch).toEqual({ setAttrs: { id: "a" } });
    });

    it("ignores enumerable keys inherited from prev's prototype", () => {
      const proto = { inheritedTitle: "ghost" };
      const prev = Object.create(proto) as Record<string, unknown>;
      prev["id"] = "a";
      const patch = diffElementProps(prev as VNodeProps, props({ id: "a" }));
      expect(patch).toBeNull();
    });

    it("ignores enumerable keys inherited from a style object's prototype", () => {
      const styleProto = { inheritedColor: "ghost" };
      const prevStyle = Object.create(styleProto) as Record<string, unknown>;
      prevStyle["color"] = "red";
      const nextStyle = Object.create(styleProto) as Record<string, unknown>;
      nextStyle["color"] = "red";
      expect(
        diffElementProps(
          props({ style: prevStyle }),
          props({ style: nextStyle }),
        ),
      ).toBeNull();
    });
  });

  describe("invariants pinned to prevent regressions", () => {
    it("event swap emits removeEvents BEFORE setEvents (bucket order)", () => {
      const prevHandler = () => {};
      const nextHandler = () => {};
      const patch = diffElementProps(
        props({ onClick: prevHandler }),
        props({ onClick: nextHandler }),
      );
      const keys = Object.keys(patch!);
      expect(keys.indexOf("removeEvents")).toBeLessThan(keys.indexOf("setEvents"));
    });

    it("ref undefined → undefined produces no refSwap", () => {
      expect(
        diffElementProps(props({ ref: undefined }), props({ ref: undefined })),
      ).toBeNull();
    });

    it("NaN on both sides de-dupes (Object.is-based compare)", () => {
      expect(
        diffElementProps(props({ tabIndex: NaN }), props({ tabIndex: NaN })),
      ).toBeNull();
    });

    it("+0 vs -0 emits a diff (documented speed trade-off)", () => {
      const patch = diffElementProps(props({ tabIndex: +0 }), props({ tabIndex: -0 }));
      expect(patch).toEqual({ setAttrs: { tabIndex: -0 } });
    });

    it("all-removed: next = {} emits every prev bucket", () => {
      const onClick = () => {};
      const prevRef = { current: null };
      const patch = diffElementProps(
        props({
          id: "a",
          onClick,
          style: { color: "red" },
          ref: prevRef,
        }),
        props({}),
      );
      expect(patch).toEqual({
        removeAttrs: ["id"],
        removeEvents: ["onClick"],
        style: null,
        refSwap: { prev: prevRef, next: undefined },
      });
    });

    it("all-added: prev = {} emits every next bucket", () => {
      const onClick = () => {};
      const nextRef = { current: null };
      const style = { color: "red" };
      const patch = diffElementProps(
        props({}),
        props({ id: "a", onClick, style, ref: nextRef }),
      );
      expect(patch).toEqual({
        setAttrs: { id: "a" },
        setEvents: { onClick },
        style,
        refSwap: { prev: undefined, next: nextRef },
      });
    });

    it("empty → empty returns null", () => {
      expect(diffElementProps(props({}), props({}))).toBeNull();
    });

    it("prev === next short-circuit returns null without walking", () => {
      const p = props({ id: "a", onClick: () => {}, style: { color: "red" } });
      expect(diffElementProps(p, p)).toBeNull();
    });
  });
});
