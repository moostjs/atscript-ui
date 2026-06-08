import { describe, it, expect } from "vitest";
import { buildTableQuery } from "./build-table-query";
import type { SortControl } from "@atscript/ui";
import type { FieldFilters } from "../filters/filter-types";

const emptyFilters: FieldFilters = {};

describe("buildTableQuery", () => {
  it("builds a minimal query with empty controls", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: emptyFilters,
    });
    expect(q).toEqual({ controls: {} });
  });

  it("adds $select from visible column paths", () => {
    const q = buildTableQuery({
      visibleColumnPaths: ["name", "age", "address.city"],
      sorters: [],
      filters: emptyFilters,
    });
    expect(q.controls!.$select).toEqual(["name", "age", "address.city"]);
  });

  it("unions extraSelect with visible columns into $select (deduped)", () => {
    const q = buildTableQuery({
      visibleColumnPaths: ["name", "age"],
      extraSelect: ["address.city", "id"],
      sorters: [],
      filters: emptyFilters,
    });
    expect(q.controls!.$select).toEqual(["name", "age", "address.city", "id"]);
  });

  it("dedups an overlapping extraSelect path so it appears once", () => {
    const q = buildTableQuery({
      visibleColumnPaths: ["name", "age"],
      extraSelect: ["age", "id"],
      sorters: [],
      filters: emptyFilters,
    });
    expect(q.controls!.$select).toEqual(["name", "age", "id"]);
  });

  it("sets $select from extraSelect alone when no visible columns", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      extraSelect: ["id", "tenant"],
      sorters: [],
      filters: emptyFilters,
    });
    expect(q.controls!.$select).toEqual(["id", "tenant"]);
  });

  it("leaves $select untouched when extraSelect is absent or empty", () => {
    const base = buildTableQuery({
      visibleColumnPaths: ["name", "age"],
      sorters: [],
      filters: emptyFilters,
    });
    const empty = buildTableQuery({
      visibleColumnPaths: ["name", "age"],
      extraSelect: [],
      sorters: [],
      filters: emptyFilters,
    });
    expect(base.controls!.$select).toEqual(["name", "age"]);
    expect(empty.controls!.$select).toEqual(["name", "age"]);
  });

  it("converts sorters to $sort", () => {
    const sorters: SortControl[] = [
      { field: "name", direction: "asc" },
      { field: "age", direction: "desc" },
    ];
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters,
      filters: emptyFilters,
    });
    expect(q.controls!.$sort).toEqual({ name: 1, age: -1 });
  });

  it("merges force sorters before user sorters", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [{ field: "name", direction: "desc" }],
      forceSorters: [{ field: "id", direction: "asc" }],
      filters: emptyFilters,
    });
    expect(q.controls!.$sort).toEqual({ id: 1, name: -1 });
  });

  it("force sorters dedup user sorters on same field", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [
        { field: "id", direction: "desc" },
        { field: "name", direction: "asc" },
      ],
      forceSorters: [{ field: "id", direction: "asc" }],
      filters: emptyFilters,
    });
    expect(q.controls!.$sort).toEqual({ id: 1, name: 1 });
  });

  it("converts user filters to Uniquery filter", () => {
    const filters: FieldFilters = {
      status: [{ type: "eq", value: ["active"] }],
    };
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters,
    });
    expect(q.filter).toEqual({ status: "active" });
  });

  it("AND-merges forceFilters with user filters", () => {
    const filters: FieldFilters = {
      name: [{ type: "contains", value: ["john"] }],
    };
    const forceFilters = { tenant: "abc" };
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters,
      forceFilters,
    });
    expect(q.filter).toEqual({
      $and: [{ tenant: "abc" }, { name: { $regex: "/john/i" } }],
    });
  });

  it("wraps same-field collision so wire shape survives upstream parser merge", () => {
    // forceFilters AND user filter target `status` with the same op — see
    // `mergeFilters` for the `$not($not(...))` wrap rationale.
    const filters: FieldFilters = {
      status: [{ type: "eq", value: ["shipped"] }],
    };
    const forceFilters = { status: "cancelled" };
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters,
      forceFilters,
    });
    expect(q.filter).toEqual({
      $and: [{ status: "cancelled" }, { $not: { $not: { status: "shipped" } } }],
    });
  });

  it("uses forceFilters alone when user filters are empty", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: emptyFilters,
      forceFilters: { deleted: false },
    });
    expect(q.filter).toEqual({ deleted: false });
  });

  it("omits filter when both force and user are empty", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: emptyFilters,
    });
    expect(q.filter).toBeUndefined();
  });

  it("adds $search for search term", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: emptyFilters,
      search: "hello",
    });
    expect(q.controls!.$search).toBe("hello");
  });

  it("adds $search with index name when searchIndex is provided", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: emptyFilters,
      search: "hello",
      searchIndex: "fulltext",
    });
    expect(q.controls!["$search:fulltext"]).toBe("hello");
    expect(q.controls!.$search).toBeUndefined();
  });

  it("does not add $search when search is empty", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: emptyFilters,
      search: "",
    });
    expect(q.controls!.$search).toBeUndefined();
  });

  it("builds a complete query with all options", () => {
    const q = buildTableQuery({
      visibleColumnPaths: ["name", "status"],
      sorters: [{ field: "name", direction: "asc" }],
      forceSorters: [{ field: "createdAt", direction: "desc" }],
      filters: { status: [{ type: "eq", value: ["active"] }] },
      forceFilters: { tenant: "t1" },
      search: "test",
    });

    expect(q.filter).toEqual({
      $and: [{ tenant: "t1" }, { status: "active" }],
    });
    expect(q.controls).toEqual({
      $select: ["name", "status"],
      $sort: { createdAt: -1, name: 1 },
      $search: "test",
    });
  });

  // ── $actions URL control ───────────────────────────────────────────────

  it("does not set controls.$actions by default", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: emptyFilters,
    });
    expect(q.controls!.$actions).toBeUndefined();
  });

  it("sets controls.$actions = true when includeActions is on", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: emptyFilters,
      includeActions: true,
    });
    expect(q.controls!.$actions).toBe(true);
  });

  it("does not set controls.$actions when includeActions is explicitly false", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: emptyFilters,
      includeActions: false,
    });
    expect(q.controls!.$actions).toBeUndefined();
  });
});
