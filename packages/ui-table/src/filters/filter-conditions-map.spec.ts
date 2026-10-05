import { describe, expect, it } from "vitest";
import { columnFilterType, conditionsForType, isTemporalKind } from "./filter-conditions-map";
import {
  columnDefaultCondition,
  columnFilter,
  columnFilterConditions,
  columnFilterKind,
  isColumnFilterable,
} from "./column-filter";
import { parseColumnFilterInput } from "./filter-input-format";

describe("conditionsForType", () => {
  it("text has contains, starts, ends, regex", () => {
    const conditions = conditionsForType("text");
    expect(conditions).toContain("contains");
    expect(conditions).toContain("starts");
    expect(conditions).toContain("ends");
    expect(conditions).toContain("regex");
    expect(conditions).toContain("eq");
    expect(conditions).toContain("ne");
    expect(conditions).toContain("bw");
    expect(conditions).toContain("null");
    expect(conditions).toContain("notNull");
  });

  it("number has gt, gte, lt, lte but no contains/starts/ends/regex", () => {
    const conditions = conditionsForType("number");
    expect(conditions).toContain("gt");
    expect(conditions).toContain("gte");
    expect(conditions).toContain("lt");
    expect(conditions).toContain("lte");
    expect(conditions).toContain("bw");
    expect(conditions).not.toContain("contains");
    expect(conditions).not.toContain("starts");
    expect(conditions).not.toContain("ends");
    expect(conditions).not.toContain("regex");
  });

  it("boolean has only eq, ne, null, notNull when nullable", () => {
    const conditions = conditionsForType("boolean");
    expect(conditions).toEqual(["eq", "ne", "null", "notNull"]);
  });

  it("drops null/notNull when nullable=false", () => {
    expect(conditionsForType("boolean", false)).toEqual(["eq", "ne"]);
    expect(conditionsForType("text", false)).not.toContain("null");
    expect(conditionsForType("text", false)).not.toContain("notNull");
    expect(conditionsForType("text", false)).toContain("contains");
    expect(conditionsForType("number", false)).not.toContain("null");
    expect(conditionsForType("number", false)).toContain("gt");
    expect(conditionsForType("date", false)).not.toContain("null");
    expect(conditionsForType("date", false)).toContain("bw");
  });

  it("date has range operators but no text-specific conditions", () => {
    const conditions = conditionsForType("date");
    expect(conditions).toContain("gt");
    expect(conditions).toContain("gte");
    expect(conditions).toContain("lt");
    expect(conditions).toContain("lte");
    expect(conditions).toContain("bw");
    expect(conditions).not.toContain("contains");
    expect(conditions).not.toContain("starts");
    expect(conditions).not.toContain("ends");
    expect(conditions).not.toContain("in");
    expect(conditions).not.toContain("nin");
    expect(conditions).not.toContain("regex");
  });
});

describe("columnFilterType", () => {
  it("maps number to number", () => {
    expect(columnFilterType("number")).toBe("number");
  });

  it("maps boolean to boolean", () => {
    expect(columnFilterType("boolean")).toBe("boolean");
  });

  it("maps date to date", () => {
    expect(columnFilterType("date")).toBe("date");
  });

  it("maps text to text", () => {
    expect(columnFilterType("text")).toBe("text");
  });

  it("defaults unknown types to text", () => {
    expect(columnFilterType("email")).toBe("text");
    expect(columnFilterType("array")).toBe("text");
    expect(columnFilterType("object")).toBe("text");
  });
});

const col = (over: Partial<Parameters<typeof columnFilterConditions>[0]>) => ({
  type: "text",
  nullable: true,
  filterable: true,
  ...over,
});

describe("columnFilterConditions / isColumnFilterable", () => {
  it("value-filterable columns offer their type's conditions", () => {
    expect(columnFilterConditions(col({ type: "number" }))).toEqual(conditionsForType("number"));
    expect(columnFilterConditions(col({ nullable: false }))).toEqual(
      conditionsForType("text", false),
    );
    expect(isColumnFilterable(col({}))).toBe(true);
  });

  it("existence-only columns offer null / notNull and nothing else", () => {
    const json = col({ type: "object", filterable: false, filterOps: ["$exists"] });
    expect(columnFilterConditions(json)).toEqual(["null", "notNull"]);
    expect(isColumnFilterable(json)).toBe(true);
  });

  it("an existence-only column that is never empty offers nothing", () => {
    const json = col({ filterable: false, filterOps: ["$exists"], nullable: false });
    expect(columnFilterConditions(json)).toEqual([]);
    expect(isColumnFilterable(json)).toBe(false);
  });

  it("non-filterable columns, and operators the UI has no condition for, offer nothing", () => {
    expect(isColumnFilterable(col({ filterable: false }))).toBe(false);
    expect(isColumnFilterable(col({ filterable: false, filterOps: ["$geoWithin"] }))).toBe(false);
  });

  it("columnDefaultCondition and parseColumnFilterInput stay inside the offered conditions", () => {
    const json = col({ filterable: false, filterOps: ["$exists"] });
    expect(columnDefaultCondition(json)).toBe("null");
    expect(columnDefaultCondition(col({}))).toBe("contains");
    expect(columnDefaultCondition(col({ type: "number" }))).toBe("eq");
    expect(parseColumnFilterInput("!<empty>", json)).toEqual({ type: "notNull", value: [] });
    expect(parseColumnFilterInput("abc", json)).toBeUndefined();
    expect(parseColumnFilterInput(">5", col({ type: "number" }))).toEqual({
      type: "gt",
      value: [5],
    });
  });
});

describe("columnFilterKind (0.1.148)", () => {
  const cases: [string, string | undefined, string][] = [
    ["datetime", "timestamp", "datetime"],
    ["text", "timestamp", "datetime"],
    ["date", "timestamp", "date"],
    ["number", "timestamp", "number"],
    ["text", "isoDate", "datetime"],
    ["datetime", "isoDate", "datetime"],
    ["date", "isoDate", "date"],
    ["text", "date", "date"],
    ["number", "integer", "number"],
    ["text", "integer", "number"],
    ["text", "decimal", "number"],
    ["text", "boolean", "boolean"],
    ["enum", "boolean", "enum"],
    ["enum", "number", "enum"],
    ["ref", "integer", "ref"],
    ["text", "string", "text"],
    ["text", undefined, "text"],
    ["datetime", undefined, "datetime"],
    ["date", undefined, "date"],
  ];
  it.each(cases)("display %s + valueKind %s → %s", (type, valueKind, expected) => {
    expect(columnFilterKind({ type, valueKind: valueKind as never })).toBe(expected);
  });

  it("columnFilterType maps datetime to its own kind", () => {
    expect(columnFilterType("datetime")).toBe("datetime");
    expect(conditionsForType("datetime")).toEqual(conditionsForType("date"));
  });
});

describe("columnFilterConditions — storage kinds (0.1.148)", () => {
  const base = { filterable: true, nullable: true };
  const PATTERN = ["contains", "starts", "ends", "regex"];

  it("a numeric ref / enum drops the pattern operators", () => {
    for (const type of ["ref", "enum"]) {
      const offered = columnFilterConditions({ ...base, type, valueKind: "integer" });
      for (const p of PATTERN) expect(offered).not.toContain(p);
      expect(offered).toContain("eq");
      expect(offered).toContain("bw");
    }
  });

  it("a string ref / enum keeps them; so does a column with no valueKind", () => {
    expect(columnFilterConditions({ ...base, type: "ref", valueKind: "string" })).toContain(
      "contains",
    );
    expect(columnFilterConditions({ ...base, type: "enum" })).toContain("regex");
  });

  it("timestamp and string.date columns offer date conditions, no contains / regex", () => {
    for (const valueKind of ["timestamp", "isoDate", "date"] as const) {
      const offered = columnFilterConditions({ ...base, type: "text", valueKind });
      for (const p of PATTERN) expect(offered).not.toContain(p);
      expect(offered).toEqual(expect.arrayContaining(["eq", "gt", "lt", "bw", "null"]));
    }
  });

  it("a non-nullable timestamp offers no empty / not-empty", () => {
    const offered = columnFilterConditions({
      ...base,
      nullable: false,
      type: "datetime",
      valueKind: "timestamp",
    });
    expect(offered).not.toContain("null");
    expect(offered).not.toContain("notNull");
  });

  it("the default condition falls back to eq when contains is not offered", () => {
    expect(columnDefaultCondition({ ...base, type: "ref", valueKind: "integer" })).toBe("eq");
    expect(columnDefaultCondition({ ...base, type: "ref", valueKind: "string" })).toBe("contains");
    expect(columnDefaultCondition({ ...base, type: "text", valueKind: "timestamp" })).toBe("eq");
  });
});

describe("the per-column filter resolver", () => {
  const base = { type: "text", nullable: true, filterable: true } as const;

  it("is derived once per column object", () => {
    const column = { ...base, valueKind: "timestamp" } as const;
    expect(columnFilter(column)).toBe(columnFilter(column));
    expect(columnFilter(column).kind).toBe("datetime");
    expect(columnFilter({ ...column })).not.toBe(columnFilter(column));
  });

  it("owns pattern stripping through conditionsForType", () => {
    expect(conditionsForType("text", true, "string")).toContain("contains");
    expect(conditionsForType("text", true, "integer")).not.toContain("contains");
    expect(conditionsForType("ref", false, "integer")).toEqual(["eq", "ne", "bw"]);
  });

  it("filterOps the server reports win over the storage rules", () => {
    const column = { ...base, filterOps: ["$eq", "$ne", "$regex"] };
    const offered = columnFilterConditions(column);
    expect(offered).toEqual(expect.arrayContaining(["eq", "ne", "contains", "regex"]));
    for (const c of ["gt", "bw", "null", "notNull"]) expect(offered).not.toContain(c);
    // a range needs both bounds
    expect(columnFilterConditions({ ...base, filterOps: ["$eq", "$gte"] })).not.toContain("bw");
    expect(columnFilterConditions({ ...base, filterOps: ["$eq", "$gte", "$lte"] })).toContain("bw");
  });

  it("a date filter is checked against the period bounds it sends", () => {
    const ts = { ...base, valueKind: "timestamp" } as const;
    const offered = columnFilterConditions({ ...ts, filterOps: ["$gte", "$lt"] });
    expect(offered).toEqual(expect.arrayContaining(["eq", "ne", "gt", "gte", "lt", "lte", "bw"]));
    expect(columnFilterConditions({ ...ts, filterOps: ["$gte"] })).not.toContain("lt");
  });

  it("without reported filterOps the valueKind rule is the fallback", () => {
    expect(columnFilterConditions({ ...base, valueKind: "integer" })).not.toContain("regex");
    expect(columnFilterConditions(base)).toContain("regex");
  });

  it("isTemporalKind", () => {
    expect(isTemporalKind("date")).toBe(true);
    expect(isTemporalKind("datetime")).toBe(true);
    expect(isTemporalKind("text")).toBe(false);
  });
});
