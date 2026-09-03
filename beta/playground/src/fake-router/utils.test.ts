import { describe, expect, it } from "vitest";
import type { Path, RouteParams } from "./types";
import { getRouteParamProperties, getSegments } from "./utils";

function paramsOf(route: Path, pathname: Path) {
  const { paramNames, paramIndexes } = getRouteParamProperties(getSegments(route));
  const segments = getSegments(pathname);
  const params: Record<string, string> = {};

  for (let i = 0; i < paramIndexes.length; i++) {
    const name = paramNames[i];
    const index = paramIndexes[i];
    params[name] = segments[index];
  }

  return params as RouteParams<any>;
}

function paramsFor(route: Path) {
  return (pathname: Path) => paramsOf(route, pathname);
}

describe("getParams", () => {
  describe("basic extraction", () => {
    it("returns an empty object when the pattern has no params", () => {
      expect(paramsOf("/hello/world", "/hello/world")).toEqual({});
    });

    it("handles the root path", () => {
      expect(paramsOf("/", "/")).toEqual({});
    });

    it("extracts a trailing param", () => {
      expect(paramsOf("/hello/:who", "/hello/world")).toEqual({ who: "world" });
    });

    it("extracts a param in the middle", () => {
      expect(paramsOf("/hello/:who/about", "/hello/world/about")).toEqual({ who: "world" });
    });

    it("extracts multiple params", () => {
      expect(paramsOf("/users/:id/posts/:postId", "/users/42/posts/7")).toEqual({
        id: "42",
        postId: "7",
      });
    });

    it("extracts a param in the first segment", () => {
      expect(paramsOf("/:lang/docs", "/fi/docs")).toEqual({ lang: "fi" });
    });
  });

  describe("nested routes (pattern shorter than pathname)", () => {
    it("extracts only its own params when the pathname goes deeper", () => {
      expect(paramsOf("/hello/:who", "/hello/world/about")).toEqual({ who: "world" });
    });

    it("returns {} for a parent route with no params", () => {
      expect(paramsOf("/hello", "/hello/world/about")).toEqual({});
    });

    it("works for an index route whose fullPath equals the parent path", () => {
      expect(paramsOf("/users/:id", "/users/42")).toEqual({ id: "42" });
    });
  });

  describe("pathname shorter than pattern", () => {
    it("omits params that have no corresponding segment", () => {
      expect(paramsOf("/hello/:who/about", "/hello")).toEqual({});
    });

    it("extracts what it can from a partial pathname", () => {
      expect(paramsOf("/users/:id/posts/:postId", "/users/42")).toEqual({ id: "42" });
    });
  });

  describe("slash normalisation", () => {
    it("ignores a trailing slash on the pathname", () => {
      expect(paramsOf("/hello/:who", "/hello/world/")).toEqual({ who: "world" });
    });

    it("ignores a trailing slash on the pattern", () => {
      expect(paramsOf("/hello/:who/", "/hello/world")).toEqual({ who: "world" });
    });

    it("collapses duplicate slashes", () => {
      expect(paramsOf("/hello/:who", "/hello//world")).toEqual({ who: "world" });
    });
  });

  describe("encoding", () => {
    it("decodes percent-encoded values", () => {
      expect(paramsOf("/hello/:who", "/hello/w%C3%B6rld")).toEqual({ who: "wörld" });
    });

    it("keeps an encoded slash inside a single segment", () => {
      expect(paramsOf("/files/:name", "/files/a%2Fb")).toEqual({ name: "a/b" });
    });

    it("does not split on an encoded slash", () => {
      expect(paramsOf("/files/:name/raw", "/files/a%2Fb/raw")).toEqual({ name: "a/b" });
    });

    it("decodes spaces", () => {
      expect(paramsOf("/search/:q", "/search/hello%20world")).toEqual({ q: "hello world" });
    });

    it("falls back to the raw value when the encoding is malformed", () => {
      expect(paramsOf("/search/:q", "/search/100%")).toEqual({ q: "100%" });
    });
  });

  describe("literal segments", () => {
    it("is case-sensitive on literals", () => {
      expect(paramsOf("/Hello/:who", "/hello/world")).toEqual({});
    });

    it("returns {} when a literal segment does not match", () => {
      expect(paramsOf("/hello/:who/about", "/goodbye/world/about")).toEqual({});
    });

    it("does not treat a value that looks like a param as a param", () => {
      expect(paramsOf("/hello/:who", "/hello/:notAParam")).toEqual({ who: ":notAParam" });
    });
  });

  describe("value shapes", () => {
    it("accepts dots and dashes", () => {
      expect(paramsOf("/files/:name", "/files/report-v1.2.json")).toEqual({
        name: "report-v1.2.json",
      });
    });

    it("accepts numeric values as strings", () => {
      expect(paramsOf("/users/:id", "/users/0")).toEqual({ id: "0" });
    });

    it("last occurrence wins for a duplicated param name", () => {
      expect(paramsOf("/a/:x/b/:x", "/a/1/b/2")).toEqual({ x: "2" });
    });
  });

  describe("memoisation", () => {
    it("does not throw on the first call", () => {
      const getParams = paramsFor("/users/:id");
      expect(() => getParams("/users/42")).not.toThrow();
    });

    it("returns the same reference when the params are unchanged", () => {
      const getParams = paramsFor("/users/:id");
      const first = getParams("/users/42");
      expect(getParams("/users/42")).toBe(first);
    });

    it("returns a new object when a param changes", () => {
      const getParams = paramsFor("/users/:id");
      const first = getParams("/users/42");
      const second = getParams("/users/43");
      expect(second).not.toBe(first);
      expect(second).toEqual({ id: "43" });
    });

    it("keeps the reference when only a deeper, unmatched segment changes", () => {
      const getParams = paramsFor("/users/:id");
      const first = getParams("/users/42/posts");
      expect(getParams("/users/42/comments")).toBe(first);
    });

    it("detects a change in the second param only", () => {
      const getParams = paramsFor("/users/:id/posts/:postId");
      const first = getParams("/users/42/posts/7");
      const second = getParams("/users/42/posts/8");
      expect(second).not.toBe(first);
      expect(second).toEqual({ id: "42", postId: "8" });
    });

    it("compares whole values, not single characters", () => {
      const getParams = paramsFor("/users/:id");
      getParams("/users/10");
      expect(getParams("/users/19")).toEqual({ id: "19" });
    });

    it("returns a stable empty object for a param-less route", () => {
      const getParams = paramsFor("/about/team");
      const first = getParams("/about/team");
      expect(getParams("/about/team")).toBe(first);
    });

    it("drops a param once the pathname no longer provides it", () => {
      const getParams = paramsFor("/users/:id");
      const first = getParams("/users/42");
      const second = getParams("/users");
      expect(second).not.toBe(first);
      expect(second).toEqual({});
    });

    it("invalidates when a literal stops matching", () => {
      const getParams = paramsFor("/users/:id");
      const first = getParams("/users/42");
      expect(getParams("/admins/42")).not.toBe(first);
      expect(getParams("/admins/42")).toEqual({});
    });
  });

  describe("immutability", () => {
    it("does not let a caller corrupt the memoised object", () => {
      const getParams = paramsFor("/users/:id");
      const first = getParams("/users/42");
      expect(() => {
        (first as Record<string, string>)["id"] = "hacked";
      }).toThrow();
      expect(getParams("/users/42")).toEqual({ id: "42" });
    });
  });
});
