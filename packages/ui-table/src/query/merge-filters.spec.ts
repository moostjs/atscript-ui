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

  // Same-field collision handling: the upstream `@uniqu/url` parser collapses
  // sibling comparison nodes that share a field+op. `mergeFilters` must emit
  // a wire shape that survives that collapse so `forceFilters` can't be
  // erased by a colliding user-side filter (Scenario 11.8 contract).

  it("wraps the colliding repeat in $not($not(...)) when same field same op collide", () => {
    const force: FilterExpr = { status: "cancelled" };
    const user: FilterExpr = { status: "shipped" };
    expect(mergeFilters(force, user)).toEqual({
      $and: [{ status: "cancelled" }, { $not: { $not: { status: "shipped" } } }],
    });
  });

  it("wraps colliding op-bag clauses with shared $eq", () => {
    const force: FilterExpr = { status: { $eq: "cancelled" } };
    const user: FilterExpr = { status: { $eq: "shipped" } };
    expect(mergeFilters(force, user)).toEqual({
      $and: [{ status: { $eq: "cancelled" } }, { $not: { $not: { status: { $eq: "shipped" } } } }],
    });
  });

  it("does NOT wrap when same field has disjoint ops (parser merges {$gte,$lte} safely)", () => {
    const force: FilterExpr = { age: { $gte: 18 } };
    const user: FilterExpr = { age: { $lte: 65 } };
    expect(mergeFilters(force, user)).toEqual({
      $and: [{ age: { $gte: 18 } }, { age: { $lte: 65 } }],
    });
  });

  it("preserves non-colliding fields un-wrapped while wrapping the colliding ones", () => {
    // Only `status` collides; `tenant` and `priority` pass through. The
    // colliding repeat is split into its own AND child in source order.
    const force: FilterExpr = { status: "cancelled", tenant: "abc" };
    const user: FilterExpr = { status: "shipped", priority: "high" };
    expect(mergeFilters(force, user)).toEqual({
      $and: [
        { status: "cancelled", tenant: "abc" },
        { $not: { $not: { status: "shipped" } } },
        { priority: "high" },
      ],
    });
  });

  it("flattens nested $and on either side before scanning for collisions", () => {
    const force: FilterExpr = { $and: [{ status: "cancelled" }, { tier: "gold" }] };
    const user: FilterExpr = { status: "shipped" };
    expect(mergeFilters(force, user)).toEqual({
      $and: [{ status: "cancelled" }, { tier: "gold" }, { $not: { $not: { status: "shipped" } } }],
    });
  });

  it("leaves $or/$not children alone (parser already preserves them)", () => {
    const force: FilterExpr = { $or: [{ status: "cancelled" }, { status: "refunded" }] };
    const user: FilterExpr = { status: "shipped" };
    expect(mergeFilters(force, user)).toEqual({
      $and: [{ $or: [{ status: "cancelled" }, { status: "refunded" }] }, { status: "shipped" }],
    });
  });
});
