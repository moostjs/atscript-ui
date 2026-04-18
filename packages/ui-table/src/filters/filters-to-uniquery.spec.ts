import { describe, expect, it } from "vitest";
import { filtersToUniqueryFilter } from "./filters-to-uniquery";
import type { FieldFilters } from "./filter-types";

describe("filtersToUniqueryFilter", () => {
  // ── Individual condition conversions ──────────────────────

  it("converts eq to bare value", () => {
    const filters: FieldFilters = {
      status: [{ type: "eq", value: ["active"] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ status: "active" });
  });

  it("converts ne to $ne", () => {
    const filters: FieldFilters = {
      status: [{ type: "ne", value: ["deleted"] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ status: { $ne: "deleted" } });
  });

  it("converts gt to $gt", () => {
    const filters: FieldFilters = {
      age: [{ type: "gt", value: [18] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ age: { $gt: 18 } });
  });

  it("converts gte to $gte", () => {
    const filters: FieldFilters = {
      age: [{ type: "gte", value: [18] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ age: { $gte: 18 } });
  });

  it("converts lt to $lt", () => {
    const filters: FieldFilters = {
      price: [{ type: "lt", value: [100] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ price: { $lt: 100 } });
  });

  it("converts lte to $lte", () => {
    const filters: FieldFilters = {
      price: [{ type: "lte", value: [100] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ price: { $lte: 100 } });
  });

  it("converts contains to $regex with escaped input", () => {
    const filters: FieldFilters = {
      name: [{ type: "contains", value: ["john"] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ name: { $regex: "/john/i" } });
  });

  it("converts contains with special regex chars to escaped $regex", () => {
    const filters: FieldFilters = {
      name: [{ type: "contains", value: ["a.b"] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ name: { $regex: "/a\\.b/i" } });
  });

  it("converts starts to $regex with ^ prefix", () => {
    const filters: FieldFilters = {
      name: [{ type: "starts", value: ["Jo"] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ name: { $regex: "/^Jo/i" } });
  });

  it("converts ends to $regex with $ suffix", () => {
    const filters: FieldFilters = {
      email: [{ type: "ends", value: ["gmail.com"] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ email: { $regex: "/gmail\\.com$/i" } });
  });

  it("converts bw to $gte + $lte", () => {
    const filters: FieldFilters = {
      price: [{ type: "bw", value: [10, 100] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ price: { $gte: 10, $lte: 100 } });
  });

  it("converts null to $exists: false", () => {
    const filters: FieldFilters = {
      deletedAt: [{ type: "null", value: [] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ deletedAt: { $exists: false } });
  });

  it("converts notNull to $exists: true", () => {
    const filters: FieldFilters = {
      deletedAt: [{ type: "notNull", value: [] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ deletedAt: { $exists: true } });
  });

  it("converts regex to raw $regex", () => {
    const filters: FieldFilters = {
      code: [{ type: "regex", value: ["^[A-Z]{3}"] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ code: { $regex: "^[A-Z]{3}" } });
  });

  // ── Combination logic ─────────────────────────────────────

  it("OR's multiple inclusion conditions for same field", () => {
    const filters: FieldFilters = {
      status: [
        { type: "eq", value: ["active"] },
        { type: "eq", value: ["pending"] },
      ],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({
      $or: [{ status: "active" }, { status: "pending" }],
    });
  });

  it("AND's multiple exclusion conditions for same field", () => {
    const filters: FieldFilters = {
      status: [
        { type: "ne", value: ["deleted"] },
        { type: "ne", value: ["archived"] },
      ],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({
      $and: [{ status: { $ne: "deleted" } }, { status: { $ne: "archived" } }],
    });
  });

  it("AND's all field groups at top level", () => {
    const filters: FieldFilters = {
      status: [{ type: "eq", value: ["active"] }],
      age: [{ type: "gt", value: [18] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({
      $and: [{ status: "active" }, { age: { $gt: 18 } }],
    });
  });

  it("handles mixed inclusion/exclusion for same field", () => {
    const filters: FieldFilters = {
      name: [
        { type: "contains", value: ["john"] },
        { type: "ne", value: ["admin"] },
      ],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({
      $and: [{ name: { $regex: "/john/i" } }, { name: { $ne: "admin" } }],
    });
  });

  it("handles full multi-field example from spec", () => {
    const filters: FieldFilters = {
      status: [
        { type: "eq", value: ["active"] },
        { type: "eq", value: ["pending"] },
      ],
      name: [
        { type: "contains", value: ["john"] },
        { type: "ne", value: ["admin"] },
      ],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({
      $and: [
        { $or: [{ status: "active" }, { status: "pending" }] },
        { name: { $regex: "/john/i" } },
        { name: { $ne: "admin" } },
      ],
    });
  });

  // ── Edge cases ────────────────────────────────────────────

  it("returns undefined for empty filters", () => {
    expect(filtersToUniqueryFilter({})).toBeUndefined();
  });

  it("skips unfilled conditions", () => {
    const filters: FieldFilters = {
      status: [{ type: "eq", value: [] }],
      name: [{ type: "eq", value: ["john"] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ name: "john" });
  });

  it("returns undefined when all conditions are unfilled", () => {
    const filters: FieldFilters = {
      status: [{ type: "eq", value: [""] }],
      name: [{ type: "gt", value: [] }],
    };
    expect(filtersToUniqueryFilter(filters)).toBeUndefined();
  });

  it("handles numeric eq value", () => {
    const filters: FieldFilters = {
      count: [{ type: "eq", value: [0] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ count: 0 });
  });

  it("handles boolean eq value", () => {
    const filters: FieldFilters = {
      active: [{ type: "eq", value: [false] }],
    };
    expect(filtersToUniqueryFilter(filters)).toEqual({ active: false });
  });
});
