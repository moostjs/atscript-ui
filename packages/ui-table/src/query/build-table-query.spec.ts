import { describe, it, expect, vi } from "vitest";
import { buildTableQuery } from "./build-table-query";
import type { SortControl } from "@atscript/ui";
import type { FieldFilters } from "../filters/filter-types";
import { createColumnValueEncoder } from "../filters/value-encoder";
import { urlQueryStringToState } from "./url-query";

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

  // ── ignoreSorters (search relevance) ───────────────────────────────────

  it("omits user sorters from $sort when ignoreSorters is true", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [{ field: "name", direction: "asc" }],
      filters: emptyFilters,
      search: "hello",
      ignoreSorters: true,
    });
    expect(q.controls!.$sort).toBeUndefined();
    expect(q.controls!.$search).toBe("hello");
  });

  it("still emits forceSorters when ignoreSorters is true", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [{ field: "name", direction: "asc" }],
      forceSorters: [{ field: "id", direction: "desc" }],
      filters: emptyFilters,
      search: "hello",
      ignoreSorters: true,
    });
    expect(q.controls!.$sort).toEqual({ id: -1 });
  });

  it("emits user sorters when ignoreSorters is false or absent", () => {
    for (const ignoreSorters of [false, undefined]) {
      const q = buildTableQuery({
        visibleColumnPaths: [],
        sorters: [{ field: "name", direction: "asc" }],
        filters: emptyFilters,
        ignoreSorters,
      });
      expect(q.controls!.$sort).toEqual({ name: 1 });
    }
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

describe("buildTableQuery — residual filters", () => {
  const OR = { $or: [{ a: 1 }, { b: 2 }] };

  it("ANDs residual conditions after the field filters, inside forceFilters", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: { c: [{ type: "eq", value: [3] }] },
      residualFilters: [OR],
      forceFilters: { d: 4 },
    });
    expect(q.filter).toEqual({ $and: [{ d: 4 }, { c: 3 }, OR] });
  });

  it("keeps a colliding residual clause parser-safe", () => {
    const q = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: { status: [{ type: "eq", value: ["A"] }] },
      residualFilters: [{ status: "B" }],
    });
    expect(q.filter).toEqual({ $and: [{ status: "A" }, { $not: { $not: { status: "B" } } }] });
  });

  it("is unchanged without residual conditions", () => {
    const base = {
      visibleColumnPaths: [],
      sorters: [],
      filters: { c: [{ type: "eq" as const, value: [3] }] },
    };
    expect(buildTableQuery({ ...base, residualFilters: [] })).toEqual(buildTableQuery(base));
  });
});

describe("buildTableQuery — encodeCondition (0.1.148)", () => {
  it("encodes field filters and residuals, but not forced filters", () => {
    const query = buildTableQuery({
      visibleColumnPaths: ["createdAt"],
      sorters: [],
      filters: { createdAt: [{ type: "eq", value: ["2026-10-05"] }] },
      residualFilters: [{ updatedAt: "2026-10-05" }],
      forceFilters: { archivedAt: "2026-10-05" },
      encodeCondition: (field, cond) =>
        field === "createdAt" || field === "updatedAt"
          ? { [field]: { $gte: 1, $lt: 2, tag: cond.type } }
          : undefined,
    });
    expect(query.filter).toEqual({
      $and: [
        { archivedAt: "2026-10-05" },
        { createdAt: { $gte: 1, $lt: 2, tag: "eq" } },
        { updatedAt: { $gte: 1, $lt: 2, tag: "eq" } },
      ],
    });
  });

  it("an undefined result falls back to the default conversion", () => {
    const query = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: { name: [{ type: "eq", value: ["a"] }] },
      encodeCondition: () => undefined,
    });
    expect(query.filter).toEqual({ name: "a" });
  });
});

describe("buildTableQuery — typed values from a URL", () => {
  const columns = [
    { path: "qty", type: "number", valueKind: "integer" },
    { path: "total", type: "number", valueKind: "decimal" },
    { path: "active", type: "boolean", valueKind: "boolean" },
  ] as const;

  it("a URL-decoded numeric filter reaches the server typed", () => {
    const { filters } = urlQueryStringToState("qty>'5'&total>100&active='true'");
    const query = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters,
      encodeCondition: createColumnValueEncoder(columns),
    });
    expect(query.filter).toEqual({
      $and: [{ qty: { $gt: 5 } }, { total: { $gt: "100" } }, { active: true }],
    });
  });
});

describe("buildTableQuery — temporal deep links (residual conditions)", () => {
  const columns = [
    { path: "createdAt", type: "datetime", valueKind: "timestamp" },
    { path: "dueOn", type: "text", valueKind: "date" },
    { path: "seenAt", type: "text", valueKind: "isoDate" },
  ] as const;
  const encodeCondition = createColumnValueEncoder(columns, { timeZone: "UTC" });
  const build = (url: string) => {
    const parsed = urlQueryStringToState(url);
    return buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: parsed.filters,
      residualFilters: parsed.residual,
      encodeCondition,
    }).filter;
  };

  it("a two-sided date range from a URL is sent as epoch bounds, never as raw text", () => {
    const filter = JSON.stringify(build("createdAt>='2026-10-01'&createdAt<'2026-10-05'"));
    expect(filter).not.toContain("2026-10-01'");
    expect(filter).toContain(String(Date.UTC(2026, 9, 1)));
    expect(filter).toContain(String(Date.UTC(2026, 9, 5)));
  });

  it("date and isoDate columns get their own storage form for residual ranges", () => {
    const { $and } = build("dueOn>='2026-10-01'&dueOn<'2026-10-05'") as { $and: unknown[] };
    expect($and).toHaveLength(2);
    expect($and).toEqual(
      expect.arrayContaining([{ dueOn: { $gte: "2026-10-01" } }, { dueOn: { $lt: "2026-10-05" } }]),
    );
    expect(JSON.stringify(build("seenAt>='2026-10-01'&seenAt<'2026-10-05'"))).toContain(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("recurses through $or / $not and leaves non-temporal fields alone", () => {
    const query = buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: {},
      residualFilters: [
        { $or: [{ createdAt: { $gte: "2026-10-01" } }, { name: "x" }] },
        { $not: { createdAt: { $lt: "2026-10-01", $exists: true } } },
      ],
      encodeCondition,
    });
    expect(query.filter).toEqual({
      $and: [
        { $or: [{ createdAt: { $gte: Date.UTC(2026, 9, 1) } }, { name: "x" }] },
        {
          $not: {
            $and: [{ createdAt: { $lt: Date.UTC(2026, 9, 1) } }, { createdAt: { $exists: true } }],
          },
        },
      ],
    });
  });
});

describe("buildTableQuery — $in / $nin residuals are typed per element", () => {
  const columns = [
    { path: "createdAt", type: "datetime", valueKind: "timestamp" },
    { path: "dueOn", type: "text", valueKind: "date" },
    { path: "qty", type: "number", valueKind: "integer" },
    { path: "active", type: "boolean", valueKind: "boolean" },
  ] as const;
  const encodeCondition = createColumnValueEncoder(columns, { timeZone: "UTC" });
  const build = (...residualFilters: Record<string, unknown>[]) =>
    buildTableQuery({
      visibleColumnPaths: [],
      sorters: [],
      filters: {},
      residualFilters: residualFilters as never,
      encodeCondition,
    }).filter;
  const day = (m: number, d: number) => Date.UTC(2026, m, d);

  it("a $in of date strings on a timestamp column expands to a $or of day ranges", () => {
    expect(build({ createdAt: { $in: ["2026-10-05", "2026-10-07"] } })).toEqual({
      $or: [
        { createdAt: { $gte: day(9, 5), $lt: day(9, 6) } },
        { createdAt: { $gte: day(9, 7), $lt: day(9, 8) } },
      ],
    });
  });

  it("a $nin of date strings becomes an $and of excluded day ranges, never raw text", () => {
    const filter = JSON.stringify(build({ createdAt: { $nin: ["2026-10-05"] } }));
    expect(filter).not.toContain("2026-10-05");
    expect(filter).toContain(String(day(9, 5)));
  });

  it("a $in on a date column matches each day, like a single $eq would", () => {
    expect(build({ dueOn: { $in: ["2026-10-05", "2026-10-07"] } })).toEqual({
      $or: [
        { dueOn: { $gte: "2026-10-05", $lt: "2026-10-06" } },
        { dueOn: { $gte: "2026-10-07", $lt: "2026-10-08" } },
      ],
    });
  });

  it("a $in of numeric / boolean text is typed and stays a list", () => {
    expect(build({ qty: { $in: ["1", "2"] } })).toEqual({ qty: { $in: [1, 2] } });
    expect(build({ active: { $nin: ["true", "false"] } })).toEqual({
      active: { $nin: [true, false] },
    });
  });

  it("leaves a $in on an unencoded field, and other operators beside it, alone", () => {
    expect(build({ name: { $in: ["a", "b"] } })).toEqual({ name: { $in: ["a", "b"] } });
    expect(build({ qty: { $in: ["1"], $exists: true } })).toEqual({
      $and: [{ qty: { $in: [1] } }, { qty: { $exists: true } }],
    });
  });

  it("keeps an element that is not a scalar", () => {
    const filter = build({ createdAt: { $in: ["2026-10-05", null] } });
    expect(JSON.stringify(filter)).toContain("null");
    expect(JSON.stringify(filter)).toContain(String(day(9, 5)));
  });
});

describe("buildTableQuery — one clock per build", () => {
  it("field filters and residuals are encoded against the same `now`", () => {
    const seen: (number | undefined)[] = [];
    const encodeCondition = ((_f: string, _c: unknown, now?: number) => {
      seen.push(now);
      return undefined;
    }) as never;
    let tick = 1000;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => (tick += 1000));
    try {
      buildTableQuery({
        visibleColumnPaths: [],
        sorters: [],
        filters: { a: [{ type: "eq", value: ["x"] }] },
        residualFilters: [{ b: "y" }] as never,
        encodeCondition,
      });
    } finally {
      spy.mockRestore();
    }
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(new Set(seen).size).toBe(1);
  });
});
