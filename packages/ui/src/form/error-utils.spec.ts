import { describe, expect, it } from "vitest";
import {
  buildDescendantErrorCounts,
  iteratePathAncestors,
  mergeErrorMaps,
  omitPaths,
} from "./error-utils";

describe("mergeErrorMaps", () => {
  it("merges multiple sources, dropping falsy values", () => {
    const merged = mergeErrorMaps({ a: "first", b: undefined }, { c: "second", d: "" }, undefined);
    expect(merged).toEqual({ a: "first", c: "second" });
  });

  it("does not let an empty value overwrite a real one", () => {
    const merged = mergeErrorMaps({ a: "real" }, { a: undefined });
    expect(merged).toEqual({ a: "real" });
  });

  it("later non-empty values overwrite earlier ones", () => {
    const merged = mergeErrorMaps({ a: "old" }, { a: "new" });
    expect(merged).toEqual({ a: "new" });
  });
});

describe("omitPaths", () => {
  it("removes the entries whose key is in the set", () => {
    const errors = { a: "one", b: "two", c: "three" };
    expect(omitPaths(errors, new Set(["a", "c"]))).toEqual({ b: "two" });
  });

  it("returns the same reference when nothing matches", () => {
    const errors = { a: "one", b: "two" };
    expect(omitPaths(errors, new Set(["x", "y"]))).toBe(errors);
    expect(omitPaths(errors, new Set())).toBe(errors);
  });

  it("does not mutate the input map", () => {
    const errors = { a: "one", b: "two" };
    omitPaths(errors, new Set(["a"]));
    expect(errors).toEqual({ a: "one", b: "two" });
  });

  it("returns the same empty map for an empty input", () => {
    const errors = {};
    expect(omitPaths(errors, new Set(["a"]))).toBe(errors);
  });
});

describe("iteratePathAncestors", () => {
  it("yields the path itself plus every dotted-path ancestor, longest-first", () => {
    expect([...iteratePathAncestors("a.b.c")]).toEqual(["a.b.c", "a.b", "a"]);
  });

  it("yields a single entry for a top-level path", () => {
    expect([...iteratePathAncestors("foo")]).toEqual(["foo"]);
  });

  it("yields nothing for empty paths and the form-level key", () => {
    expect([...iteratePathAncestors("")]).toEqual([]);
    expect([...iteratePathAncestors("__form")]).toEqual([]);
  });
});

describe("buildDescendantErrorCounts", () => {
  it("counts each error at its path and every ancestor", () => {
    const counts = buildDescendantErrorCounts({
      "user.name": "required",
      "user.email": "invalid",
      "address.street": "required",
    });
    expect(counts.get("user.name")).toBe(1);
    expect(counts.get("user.email")).toBe(1);
    expect(counts.get("user")).toBe(2);
    expect(counts.get("address.street")).toBe(1);
    expect(counts.get("address")).toBe(1);
  });

  it("ignores falsy error values and the form-level key", () => {
    const counts = buildDescendantErrorCounts({
      "a.b": "real",
      "c.d": undefined,
      "e.f": "",
      __form: "form-level",
    });
    expect(counts.get("a.b")).toBe(1);
    expect(counts.get("a")).toBe(1);
    expect(counts.has("c.d")).toBe(false);
    expect(counts.has("e.f")).toBe(false);
    expect(counts.has("__form")).toBe(false);
  });

  it("returns an empty map for an empty input", () => {
    expect(buildDescendantErrorCounts({}).size).toBe(0);
  });
});
