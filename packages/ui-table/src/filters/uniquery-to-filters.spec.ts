import { describe, expect, it, vi } from "vitest";
import type { FilterExpr } from "@uniqu/core";
import { filtersToUniqueryFilter } from "./filters-to-uniquery";
import { uniqueryFilterToFieldFilters, type UnsupportedFilter } from "./uniquery-to-filters";
import type { FieldFilters } from "./filter-types";

/** Decode with a collecting handler, so a test sees exactly what was reported. */
function decode(expr: FilterExpr, knownFields?: string[]) {
  const issues: UnsupportedFilter[] = [];
  const filters = uniqueryFilterToFieldFilters(expr, knownFields, (issue) => issues.push(issue));
  return { filters, issues };
}

const eq = (v: string | number) => ({ type: "eq" as const, value: [v] });
const ne = (v: string | number) => ({ type: "ne" as const, value: [v] });

describe("uniqueryFilterToFieldFilters — $in / $nin", () => {
  it("round-trips a same-field $in as OR'd equalities (regression: it vanished)", () => {
    const expr = { status: { $in: ["OPEN", "IN_REVIEW"] } };
    const { filters, issues } = decode(expr);
    expect(filters).toEqual({ status: [eq("OPEN"), eq("IN_REVIEW")] });
    expect(issues).toEqual([]);
    expect(filtersToUniqueryFilter(filters)).toEqual({
      $or: [{ status: "OPEN" }, { status: "IN_REVIEW" }],
    });
  });

  it("maps a null member of $in to the empty condition", () => {
    expect(decode({ owner: { $in: ["a", null] } }).filters).toEqual({
      owner: [eq("a"), { type: "null", value: [] }],
    });
  });

  it("maps $nin to AND'd inequalities", () => {
    const { filters, issues } = decode({ status: { $nin: ["DONE", "VOID"] } });
    expect(filters).toEqual({ status: [ne("DONE"), ne("VOID")] });
    expect(issues).toEqual([]);
    expect(filtersToUniqueryFilter(filters)).toEqual({
      $and: [{ status: { $ne: "DONE" } }, { status: { $ne: "VOID" } }],
    });
  });

  it("treats an empty $nin as no constraint and reports an empty $in", () => {
    expect(decode({ status: { $nin: [] } })).toEqual({ filters: {}, issues: [] });
    const { filters, issues } = decode({ status: { $in: [] } });
    expect(filters).toEqual({});
    expect(issues).toEqual([
      { reason: "operator", expr: { status: { $in: [] } }, fields: ["status"] },
    ]);
  });
});

describe("uniqueryFilterToFieldFilters — never broadens silently", () => {
  it("reports a correlated cross-field $or instead of splitting it (regression)", () => {
    const expr = {
      $or: [
        { lane: "FAST", openedAt: { $lte: 100 } },
        { lane: "SLOW", openedAt: { $lte: 50 } },
      ],
    };
    const { filters, issues } = decode(expr);
    // Before: {$and:[lane∈{FAST,SLOW}, openedAt≤100 OR openedAt≤50]} — a SLOW
    // row at 75 matched the reconstruction but not the input.
    expect(filters).toEqual({});
    expect(issues).toEqual([{ reason: "cross-field", expr, fields: ["lane", "openedAt"] }]);
    expect(filtersToUniqueryFilter(filters)).toBeUndefined();
  });

  it("reports a plain cross-field $or instead of turning it into an AND", () => {
    const { filters, issues } = decode({ $or: [{ a: 1 }, { b: 2 }] });
    expect(filters).toEqual({});
    expect(issues.map((i) => i.reason)).toEqual(["cross-field"]);
  });

  it("keeps the representable conjuncts next to a reported one", () => {
    const expr = { $and: [{ team: "core" }, { $or: [{ a: 1 }, { b: 2 }] }] };
    const { filters, issues } = decode(expr);
    expect(filters).toEqual({ team: [eq("core")] });
    expect(issues).toHaveLength(1);
    expect(issues[0].expr).toEqual({ $or: [{ a: 1 }, { b: 2 }] });
  });

  it("reports a second positive group AND'd on one field and keeps the first", () => {
    const { filters, issues } = decode({ total: { $gt: 1, $lt: 5 } });
    expect(filters).toEqual({ total: [{ type: "gt", value: [1] }] });
    expect(issues).toEqual([
      { reason: "conjunction", expr: { total: { $lt: 5 } }, fields: ["total"] },
    ]);
  });

  it("joins a split $gte / $lte pair back into between", () => {
    const { filters, issues } = decode({ $and: [{ n: { $gte: 1 } }, { n: { $lte: 9 } }] });
    expect(filters).toEqual({ n: [{ type: "bw", value: [1, 9] }] });
    expect(issues).toEqual([]);
  });

  it("joins a split pair inside an $or branch too", () => {
    const { filters, issues } = decode({
      $or: [{ $and: [{ n: { $lte: 9 } }, { n: { $gte: 1 } }] }, { n: 20 }],
    });
    expect(filters).toEqual({ n: [{ type: "bw", value: [1, 9] }, eq(20)] });
    expect(issues).toEqual([]);
  });

  it("drops a repeated identical condition without a report", () => {
    expect(decode({ $and: [{ a: 1 }, { a: 1 }] })).toEqual({
      filters: { a: [eq(1)] },
      issues: [],
    });
  });

  it("reports unknown operators and keeps the known ones of the same field", () => {
    const { filters, issues } = decode({ name: { $weirdOp: "x", $eq: "ok" } });
    expect(filters).toEqual({ name: [eq("ok")] });
    expect(issues).toEqual([
      { reason: "operator", expr: { name: { $weirdOp: "x" } }, fields: ["name"] },
    ]);
  });

  it("reports unknown logical keys", () => {
    const { issues } = decode({ $nor: [{ a: 1 }] } as FilterExpr);
    expect(issues).toEqual([{ reason: "operator", expr: { $nor: [{ a: 1 }] }, fields: ["a"] }]);
  });

  it("reports a negative inside an $or", () => {
    const { filters, issues } = decode({ $or: [{ a: 1 }, { a: { $ne: 5 } }] });
    expect(filters).toEqual({});
    expect(issues.map((i) => i.reason)).toEqual(["negation"]);
  });
});

describe("uniqueryFilterToFieldFilters — sibling fields and logical nodes", () => {
  it("keeps plain fields that sit next to $or (regression: they were dropped)", () => {
    const { filters, issues } = decode({ team: "core", $or: [{ a: 1 }, { a: 2 }] });
    expect(filters).toEqual({ team: [eq("core")], a: [eq(1), eq(2)] });
    expect(issues).toEqual([]);
  });

  it("keeps plain fields that sit next to $and and $not", () => {
    expect(decode({ team: "core", $and: [{ a: 1 }] }).filters).toEqual({
      team: [eq("core")],
      a: [eq(1)],
    });
    expect(decode({ team: "core", $not: { a: 1 } }).filters).toEqual({
      team: [eq("core")],
      a: [ne(1)],
    });
  });

  it("merges nested same-field $or branches, including $in and between", () => {
    const expr = {
      $or: [{ n: { $in: [1, 2] } }, { $or: [{ n: { $gte: 5, $lte: 7 } }, { n: 9 }] }],
    };
    expect(decode(expr)).toEqual({
      filters: { n: [eq(1), eq(2), { type: "bw", value: [5, 7] }, eq(9)] },
      issues: [],
    });
  });

  it("treats an $or with an empty branch as no constraint", () => {
    expect(decode({ $or: [{ a: 1 }, {}] })).toEqual({ filters: {}, issues: [] });
  });

  it("inverts $not of equality / emptiness (De Morgan)", () => {
    expect(decode({ $not: { a: { $in: [1, 2] } } }).filters).toEqual({ a: [ne(1), ne(2)] });
    expect(decode({ $not: { a: { $exists: true } } }).filters).toEqual({
      a: [{ type: "null", value: [] }],
    });
    expect(decode({ $not: { $and: [{ a: { $ne: 1 } }, { a: { $ne: 2 } }] } }).filters).toEqual({
      a: [eq(1), eq(2)],
    });
  });

  it("reports a $not it cannot invert", () => {
    expect(decode({ $not: { a: { $gt: 5 } } }).issues.map((i) => i.reason)).toEqual(["negation"]);
    expect(decode({ $not: { a: 1, b: 2 } }).issues.map((i) => i.reason)).toEqual(["cross-field"]);
  });
});

describe("uniqueryFilterToFieldFilters — knownFields", () => {
  it("ignores pieces on unknown fields without a report", () => {
    const { filters, issues } = decode(
      { tab: "settings", status: "open", $or: [{ tab: "a" }, { page: 2 }] },
      ["status"],
    );
    expect(filters).toEqual({ status: [eq("open")] });
    expect(issues).toEqual([]);
  });

  it("reports a piece that mixes known and unknown fields", () => {
    const { issues } = decode({ $or: [{ status: "open" }, { tab: "a" }] }, ["status"]);
    expect(issues.map((i) => i.reason)).toEqual(["cross-field"]);
  });
});

describe("uniqueryFilterToFieldFilters — reporting", () => {
  it("warns in dev mode when no handler is given", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const filters = uniqueryFilterToFieldFilters({ $or: [{ a: 1 }, { b: 2 }] });
      expect(filters).toEqual({});
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(
        /^\[ui-table\] Filter left out \(cross-field\)/,
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("stays silent for everything the encoder produces", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onUnsupported = vi.fn();
    const all: FieldFilters = {
      status: [eq("a"), eq("b"), { type: "null", value: [] }, ne("c"), ne("d")],
      total: [
        { type: "gt", value: [1] },
        { type: "lte", value: [100] },
        { type: "bw", value: [5, 9] },
      ],
      name: [
        { type: "contains", value: ["x"] },
        { type: "starts", value: ["y"] },
        { type: "ends", value: ["z"] },
        { type: "regex", value: ["^q"] },
      ],
      note: [{ type: "notNull", value: [] }],
    };
    try {
      const encoded = filtersToUniqueryFilter(all);
      const decoded = uniqueryFilterToFieldFilters(encoded, undefined, onUnsupported);
      expect(onUnsupported).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(filtersToUniqueryFilter(decoded)).toEqual(encoded);
    } finally {
      warn.mockRestore();
    }
  });
});
