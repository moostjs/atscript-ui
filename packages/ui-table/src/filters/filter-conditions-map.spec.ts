import { describe, expect, it } from "vitest";
import { columnFilterType, conditionsForType } from "./filter-conditions-map";

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
