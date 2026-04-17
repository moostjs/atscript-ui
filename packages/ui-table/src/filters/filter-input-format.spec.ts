import { describe, expect, it } from "vitest";
import { parseFilterInput, formatFilterCondition } from "./filter-input-format";

describe("parseFilterInput", () => {
  // ── Null / not-null literals ───────────────────────────────
  it("parses <empty> as null", () => {
    expect(parseFilterInput("<empty>", "text")).toEqual({ type: "null", value: [] });
    expect(parseFilterInput("<EMPTY>", "number")).toEqual({ type: "null", value: [] });
    expect(parseFilterInput("<Empty>", "date")).toEqual({ type: "null", value: [] });
  });

  it("parses !<empty> as notNull", () => {
    expect(parseFilterInput("!<empty>", "text")).toEqual({ type: "notNull", value: [] });
    expect(parseFilterInput("!<EMPTY>", "number")).toEqual({ type: "notNull", value: [] });
  });

  // ── Regex ──────────────────────────────────────────────────
  it("parses /pattern/ as regex on text", () => {
    expect(parseFilterInput("/^[A-Z]/", "text")).toEqual({ type: "regex", value: ["^[A-Z]"] });
  });

  it("returns undefined for regex on number column", () => {
    expect(parseFilterInput("/pattern/", "number")).toBeUndefined();
  });

  it("treats // as default (not regex) since pattern is empty", () => {
    // "//" is only 2 chars, regex needs >= 3 (/x/), so falls through to default
    expect(parseFilterInput("//", "text")).toEqual({ type: "contains", value: ["//"] });
  });

  // ── Between ────────────────────────────────────────────────
  it("parses lo...hi as between on number", () => {
    expect(parseFilterInput("10...20", "number")).toEqual({ type: "bw", value: [10, 20] });
  });

  it("parses between on text", () => {
    expect(parseFilterInput("A...Z", "text")).toEqual({ type: "bw", value: ["A", "Z"] });
  });

  it("parses between on date", () => {
    expect(parseFilterInput("2024-01-01...2024-12-31", "date")).toEqual({
      type: "bw",
      value: ["2024-01-01", "2024-12-31"],
    });
  });

  it("parses between with negative numbers", () => {
    expect(parseFilterInput("-10...20", "number")).toEqual({ type: "bw", value: [-10, 20] });
  });

  it("returns undefined for between missing right side", () => {
    expect(parseFilterInput("10...", "number")).toBeUndefined();
  });

  it("returns undefined for between missing left side", () => {
    expect(parseFilterInput("...20", "number")).toBeUndefined();
  });

  // ── Prefix operators ───────────────────────────────────────
  it("parses != as ne", () => {
    expect(parseFilterInput("!=deleted", "text")).toEqual({ type: "ne", value: ["deleted"] });
  });

  it("parses != on number", () => {
    expect(parseFilterInput("!=5", "number")).toEqual({ type: "ne", value: [5] });
  });

  it("parses >= as gte", () => {
    expect(parseFilterInput(">=50", "number")).toEqual({ type: "gte", value: [50] });
  });

  it("parses <= as lte", () => {
    expect(parseFilterInput("<=500", "number")).toEqual({ type: "lte", value: [500] });
  });

  it("parses > as gt", () => {
    expect(parseFilterInput(">50", "number")).toEqual({ type: "gt", value: [50] });
  });

  it("parses < as lt", () => {
    expect(parseFilterInput("<100", "number")).toEqual({ type: "lt", value: [100] });
  });

  it("parses = as eq", () => {
    expect(parseFilterInput("=exact", "text")).toEqual({ type: "eq", value: ["exact"] });
  });

  it("parses = on number", () => {
    expect(parseFilterInput("=42", "number")).toEqual({ type: "eq", value: [42] });
  });

  it("returns undefined for gt/lt on text (not available)", () => {
    expect(parseFilterInput(">50", "text")).toBeUndefined();
    expect(parseFilterInput("<50", "text")).toBeUndefined();
    expect(parseFilterInput(">=50", "text")).toBeUndefined();
    expect(parseFilterInput("<=50", "text")).toBeUndefined();
  });

  it("returns undefined for > with non-number on number column", () => {
    expect(parseFilterInput(">abc", "number")).toBeUndefined();
  });

  // ── Wildcards ──────────────────────────────────────────────
  it("parses *text* as contains", () => {
    expect(parseFilterInput("*hello*", "text")).toEqual({ type: "contains", value: ["hello"] });
  });

  it("parses text* as starts", () => {
    expect(parseFilterInput("hello*", "text")).toEqual({ type: "starts", value: ["hello"] });
  });

  it("parses *text as ends", () => {
    expect(parseFilterInput("*hello", "text")).toEqual({ type: "ends", value: ["hello"] });
  });

  it("returns undefined for wildcards on number column", () => {
    expect(parseFilterInput("*50*", "number")).toBeUndefined();
    expect(parseFilterInput("50*", "number")).toBeUndefined();
    expect(parseFilterInput("*50", "number")).toBeUndefined();
  });

  // ── Defaults ───────────────────────────────────────────────
  it("defaults to contains for text", () => {
    expect(parseFilterInput("hello", "text")).toEqual({ type: "contains", value: ["hello"] });
  });

  it("defaults to contains for enum", () => {
    expect(parseFilterInput("active", "enum")).toEqual({ type: "contains", value: ["active"] });
  });

  it("defaults to contains for ref", () => {
    expect(parseFilterInput("john", "ref")).toEqual({ type: "contains", value: ["john"] });
  });

  it("defaults to eq for number", () => {
    expect(parseFilterInput("42", "number")).toEqual({ type: "eq", value: [42] });
  });

  it("defaults to eq for date", () => {
    expect(parseFilterInput("2024-01-15", "date")).toEqual({ type: "eq", value: ["2024-01-15"] });
  });

  it("defaults to eq for boolean", () => {
    expect(parseFilterInput("true", "boolean")).toEqual({ type: "eq", value: ["true"] });
  });

  // ── Edge cases ─────────────────────────────────────────────
  it("returns undefined for empty string", () => {
    expect(parseFilterInput("", "text")).toBeUndefined();
  });

  it("returns undefined for whitespace only", () => {
    expect(parseFilterInput("   ", "text")).toBeUndefined();
  });

  it("trims whitespace around input", () => {
    expect(parseFilterInput("  >50  ", "number")).toEqual({ type: "gt", value: [50] });
  });

  it("trims whitespace after operator", () => {
    expect(parseFilterInput(">  50", "number")).toEqual({ type: "gt", value: [50] });
  });

  it("returns undefined for invalid number default", () => {
    expect(parseFilterInput("abc", "number")).toBeUndefined();
  });

  it("handles decimal numbers", () => {
    expect(parseFilterInput("3.14", "number")).toEqual({ type: "eq", value: [3.14] });
    expect(parseFilterInput(">3.14", "number")).toEqual({ type: "gt", value: [3.14] });
  });

  it("handles negative numbers", () => {
    expect(parseFilterInput("-5", "number")).toEqual({ type: "eq", value: [-5] });
    expect(parseFilterInput(">-5", "number")).toEqual({ type: "gt", value: [-5] });
  });

  it("does not confuse < prefix with <empty>", () => {
    expect(parseFilterInput("<100", "number")).toEqual({ type: "lt", value: [100] });
    expect(parseFilterInput("<empty>", "number")).toEqual({ type: "null", value: [] });
  });
});

describe("formatFilterCondition", () => {
  it("formats eq as bare value", () => {
    expect(formatFilterCondition({ type: "eq", value: [42] })).toBe("42");
    expect(formatFilterCondition({ type: "eq", value: ["hello"] })).toBe("hello");
  });

  it("formats ne with != prefix", () => {
    expect(formatFilterCondition({ type: "ne", value: ["deleted"] })).toBe("!=deleted");
  });

  it("formats gt with > prefix", () => {
    expect(formatFilterCondition({ type: "gt", value: [50] })).toBe(">50");
  });

  it("formats gte with >= prefix", () => {
    expect(formatFilterCondition({ type: "gte", value: [50] })).toBe(">=50");
  });

  it("formats lt with < prefix", () => {
    expect(formatFilterCondition({ type: "lt", value: [100] })).toBe("<100");
  });

  it("formats lte with <= prefix", () => {
    expect(formatFilterCondition({ type: "lte", value: [500] })).toBe("<=500");
  });

  it("formats contains with * wrapping", () => {
    expect(formatFilterCondition({ type: "contains", value: ["hello"] })).toBe("*hello*");
  });

  it("formats starts with trailing *", () => {
    expect(formatFilterCondition({ type: "starts", value: ["hello"] })).toBe("hello*");
  });

  it("formats ends with leading *", () => {
    expect(formatFilterCondition({ type: "ends", value: ["hello"] })).toBe("*hello");
  });

  it("formats bw with ... separator", () => {
    expect(formatFilterCondition({ type: "bw", value: [10, 20] })).toBe("10...20");
  });

  it("formats null as <empty>", () => {
    expect(formatFilterCondition({ type: "null", value: [] })).toBe("<empty>");
  });

  it("formats notNull as !<empty>", () => {
    expect(formatFilterCondition({ type: "notNull", value: [] })).toBe("!<empty>");
  });

  it("formats regex with / wrapping", () => {
    expect(formatFilterCondition({ type: "regex", value: ["^[A-Z]"] })).toBe("/^[A-Z]/");
  });
});

describe("round-trip: format(parse(x)) ≈ x", () => {
  const cases: [string, string, "text" | "number"][] = [
    ["*hello*", "*hello*", "text"],
    ["hello*", "hello*", "text"],
    ["*hello", "*hello", "text"],
    ["!=deleted", "!=deleted", "text"],
    [">50", ">50", "number"],
    [">=50", ">=50", "number"],
    ["<100", "<100", "number"],
    ["<=500", "<=500", "number"],
    ["10...20", "10...20", "number"],
    ["<empty>", "<empty>", "text"],
    ["!<empty>", "!<empty>", "text"],
    ["/^test/", "/^test/", "text"],
    ["=exact", "exact", "text"], // eq formats without = prefix
    ["42", "42", "number"],
  ];

  for (const [input, expected, colType] of cases) {
    it(`${colType}: "${input}" → "${expected}"`, () => {
      const parsed = parseFilterInput(input, colType);
      expect(parsed).toBeDefined();
      expect(formatFilterCondition(parsed!)).toBe(expected);
    });
  }
});
