import { describe, it, expect } from "vitest";
import { mergeFilters } from "./merge-filters";
import type { FilterExpr } from "@uniqu/core";

describe("mergeFilters", () => {
  const filterA: FilterExpr = { status: "active" };
  const filterB: FilterExpr = { age: { $gt: 18 } };

  it("returns undefined when both are undefined", () => {
    expect(mergeFilters(undefined, undefined)).toBeUndefined();
  });

  it("returns the first when second is undefined", () => {
    expect(mergeFilters(filterA, undefined)).toEqual(filterA);
  });

  it("returns the second when first is undefined", () => {
    expect(mergeFilters(undefined, filterB)).toEqual(filterB);
  });

  it("returns $and of both when both are present", () => {
    expect(mergeFilters(filterA, filterB)).toEqual({
      $and: [filterA, filterB],
    });
  });

  it("works with complex filter expressions", () => {
    const complex: FilterExpr = { $or: [{ x: 1 }, { y: 2 }] };
    expect(mergeFilters(complex, filterA)).toEqual({
      $and: [complex, filterA],
    });
  });
});
