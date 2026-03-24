import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { extractLiteralOptions, isPureLiteralUnion } from "./extract-literals";

// ── Helpers ──────────────────────────────────────────────────

function literal(value: string | number) {
  return defineAnnotatedType()
    .designType(typeof value === "string" ? "string" : "number")
    .value(value).$type;
}

function stringType() {
  return defineAnnotatedType().designType("string").$type;
}

function numberType() {
  return defineAnnotatedType().designType("number").$type;
}

// ── Tests ────────────────────────────────────────────────────

describe("extractLiteralOptions", () => {
  it("returns options for a pure string literal union", () => {
    const union = defineAnnotatedType("union")
      .item(literal("a"))
      .item(literal("b"))
      .item(literal("c")).$type;

    expect(extractLiteralOptions(union)).toEqual([
      { key: "a", label: "a" },
      { key: "b", label: "b" },
      { key: "c", label: "c" },
    ]);
  });

  it("returns options for a pure number literal union", () => {
    const union = defineAnnotatedType("union")
      .item(literal(1))
      .item(literal(2))
      .item(literal(3)).$type;

    expect(extractLiteralOptions(union)).toEqual([
      { key: "1", label: "1" },
      { key: "2", label: "2" },
      { key: "3", label: "3" },
    ]);
  });

  it("returns options for mixed string/number literal union", () => {
    const union = defineAnnotatedType("union").item(literal("a")).item(literal(1)).$type;

    expect(extractLiteralOptions(union)).toEqual([
      { key: "a", label: "a" },
      { key: "1", label: "1" },
    ]);
  });

  it("returns undefined for non-literal union (string | number)", () => {
    const union = defineAnnotatedType("union").item(stringType()).item(numberType()).$type;

    expect(extractLiteralOptions(union)).toBeUndefined();
  });

  it("returns undefined for mixed literal + non-literal union", () => {
    const union = defineAnnotatedType("union").item(literal("a")).item(stringType()).$type;

    expect(extractLiteralOptions(union)).toBeUndefined();
  });

  it("returns undefined for non-union types", () => {
    expect(extractLiteralOptions(stringType())).toBeUndefined();
    expect(extractLiteralOptions(numberType())).toBeUndefined();
  });

  it("handles nested unions by flattening", () => {
    const inner = defineAnnotatedType("union").item(literal("a")).item(literal("b")).$type;
    const outer = defineAnnotatedType("union").item(inner).item(literal("c")).$type;

    expect(extractLiteralOptions(outer)).toEqual([
      { key: "a", label: "a" },
      { key: "b", label: "b" },
      { key: "c", label: "c" },
    ]);
  });

  it("deduplicates literal values", () => {
    const union = defineAnnotatedType("union")
      .item(literal("a"))
      .item(literal("a"))
      .item(literal("b")).$type;

    expect(extractLiteralOptions(union)).toEqual([
      { key: "a", label: "a" },
      { key: "b", label: "b" },
    ]);
  });
});

describe("isPureLiteralUnion", () => {
  it("returns true for pure literal union", () => {
    const union = defineAnnotatedType("union").item(literal("a")).item(literal("b")).$type;

    expect(isPureLiteralUnion(union)).toBe(true);
  });

  it("returns false for non-literal union", () => {
    const union = defineAnnotatedType("union").item(stringType()).item(numberType()).$type;

    expect(isPureLiteralUnion(union)).toBe(false);
  });

  it("returns false for non-union type", () => {
    expect(isPureLiteralUnion(stringType())).toBe(false);
  });
});
