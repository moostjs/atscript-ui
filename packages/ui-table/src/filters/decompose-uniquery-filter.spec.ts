import { describe, expect, it, vi } from "vitest";
import type { FilterExpr } from "@uniqu/core";
import {
  decomposeUniqueryFilter,
  filterExprFields,
  normalizeResidualFilters,
  uniqueryFilterToFieldFilters,
} from "./uniquery-to-filters";

const CORRELATED: FilterExpr = {
  $or: [
    { path: "FAST", raisedAt: { $lte: 100 } },
    { path: "SLOW", raisedAt: { $lte: 50 } },
  ],
};

describe("decomposeUniqueryFilter", () => {
  it("returns the 0.1.139 split without carry", () => {
    const expr: FilterExpr = { $and: [{ customerId: 2 }, CORRELATED] };
    const out = decomposeUniqueryFilter(expr);
    expect(out.filters).toEqual({ customerId: [{ type: "eq", value: [2] }] });
    expect(out.residual).toEqual([]);
    expect(out.unsupported).toEqual([
      { reason: "cross-field", expr: CORRELATED, fields: ["path", "raisedAt"] },
    ]);
  });

  it("carries a correlated cross-field $or", () => {
    const out = decomposeUniqueryFilter(CORRELATED, { carry: true });
    expect(out.filters).toEqual({});
    expect(out.residual).toEqual([CORRELATED]);
    expect(out.unsupported).toEqual([]);
  });

  it("splits field filters from residual conditions", () => {
    const expr: FilterExpr = { customerId: 2, $not: { status: "x", total: { $gt: 1 } } };
    const out = decomposeUniqueryFilter(expr, { carry: true });
    expect(out.filters).toEqual({ customerId: [{ type: "eq", value: [2] }] });
    expect(out.residual).toEqual([{ $not: { status: "x", total: { $gt: 1 } } }]);
  });

  it("lists a mixed known/unknown piece as unknown, not unsupported", () => {
    const expr: FilterExpr = {
      $and: [{ $or: [{ a: 1 }, { ghost: 2 }] }, { $or: [{ x: 1 }, { y: 2 }] }],
    };
    const out = decomposeUniqueryFilter(expr, { carry: true, knownFields: ["a"] });
    expect(out.residual).toEqual([]);
    expect(out.unsupported).toEqual([]);
    expect(out.unknown).toEqual([
      { expr: { $or: [{ a: 1 }, { ghost: 2 }] }, fields: ["ghost"] },
      { expr: { $or: [{ x: 1 }, { y: 2 }] }, fields: ["x", "y"] },
    ]);
  });

  it("lists single-field pieces on unknown fields as unknown", () => {
    const expr: FilterExpr = { a: 1, ghost: { $regex: "/x/i", $ne: "y" }, spook: { $nin: [1, 2] } };
    const out = decomposeUniqueryFilter(expr, { knownFields: ["a"] });
    expect(out.filters).toEqual({ a: [{ type: "eq", value: [1] }] });
    expect(out.unknown).toEqual([
      { expr: { ghost: { $regex: "/x/i" } }, fields: ["ghost"] },
      { expr: { ghost: { $ne: "y" } }, fields: ["ghost"] },
      { expr: { spook: { $nin: [1, 2] } }, fields: ["spook"] },
    ]);
  });

  it("has no unknown pieces without knownFields", () => {
    const out = decomposeUniqueryFilter({ ghost: 1, $or: [{ a: 1 }, { b: 2 }] }, { carry: true });
    expect(out.unknown).toEqual([]);
  });

  it("does not carry a piece that references no field", () => {
    const out = decomposeUniqueryFilter({ $or: [] } as FilterExpr, { carry: true });
    expect(out.residual).toEqual([]);
    expect(out.unsupported).toHaveLength(1);
  });

  it("moves every positive group of a conjoined field, keeping its negatives", () => {
    const expr: FilterExpr = { a: { $ne: 3, $gt: 1, $lt: 5 }, b: 1 };
    const out = decomposeUniqueryFilter(expr, { carry: true });
    expect(out.filters).toEqual({
      a: [{ type: "ne", value: [3] }],
      b: [{ type: "eq", value: [1] }],
    });
    expect(out.residual).toEqual([{ a: { $lt: 5 } }, { a: { $gt: 1 } }]);
    expect(out.unsupported).toEqual([]);
  });

  it("does not carry a repeated identical group", () => {
    const expr: FilterExpr = { $and: [{ a: 1 }, { a: 1 }, { a: 2 }] };
    const out = decomposeUniqueryFilter(expr, { carry: true });
    expect(out.filters).toEqual({});
    expect(out.residual).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("reads $not $not p as p", () => {
    const expr: FilterExpr = { $not: { $not: { a: { $gt: 1 } } } };
    expect(decomposeUniqueryFilter(expr).filters).toEqual({ a: [{ type: "gt", value: [1] }] });
  });

  it("stays exact for encoder output", () => {
    const expr: FilterExpr = {
      $and: [{ $or: [{ s: "a" }, { s: "b" }] }, { t: { $gte: 1, $lte: 5 } }],
    };
    const out = decomposeUniqueryFilter(expr, { carry: true });
    expect(out.residual).toEqual([]);
    expect(out.filters).toEqual({
      s: [
        { type: "eq", value: ["a"] },
        { type: "eq", value: ["b"] },
      ],
      t: [{ type: "bw", value: [1, 5] }],
    });
  });
});

describe("uniqueryFilterToFieldFilters stays a 0.1.139 wrapper", () => {
  it("reports every left-out piece and carries nothing", () => {
    const report = vi.fn();
    const filters = uniqueryFilterToFieldFilters({ a: { $gt: 1, $lt: 5 } }, undefined, report);
    expect(filters).toEqual({ a: [{ type: "gt", value: [1] }] });
    expect(report).toHaveBeenCalledWith({
      reason: "conjunction",
      expr: { a: { $lt: 5 } },
      fields: ["a"],
    });
  });
});

describe("normalizeResidualFilters", () => {
  it("drops empty expressions and duplicates, sorts by URL spelling", () => {
    expect(normalizeResidualFilters([{ b: 1 }, {}, { a: 1 }, { b: 1 }])).toEqual([
      { a: 1 },
      { b: 1 },
    ]);
  });
});

describe("filterExprFields", () => {
  it("lists referenced fields in order, through logical operators", () => {
    expect(filterExprFields(CORRELATED)).toEqual(["path", "raisedAt"]);
    expect(filterExprFields({ $not: { $or: [{ c: 1 }, { a: { $in: [1] } }] }, b: 2 })).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
});
