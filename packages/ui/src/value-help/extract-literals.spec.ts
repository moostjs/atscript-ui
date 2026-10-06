import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { extractLiteralOptions, isPureLiteralUnion } from "./extract-literals";

// ── Helpers ──────────────────────────────────────────────────

function literal(value: string | number | boolean) {
  return defineAnnotatedType()
    .designType(typeof value as "string" | "number" | "boolean")
    .value(value as never).$type;
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
      { key: "a", label: "a", value: "a" },
      { key: "b", label: "b", value: "b" },
      { key: "c", label: "c", value: "c" },
    ]);
  });

  it("returns options for a pure number literal union", () => {
    const union = defineAnnotatedType("union")
      .item(literal(1))
      .item(literal(2))
      .item(literal(3)).$type;

    expect(extractLiteralOptions(union)).toEqual([
      { key: "1", label: "1", value: 1 },
      { key: "2", label: "2", value: 2 },
      { key: "3", label: "3", value: 3 },
    ]);
  });

  it("returns options for mixed string/number literal union", () => {
    const union = defineAnnotatedType("union").item(literal("a")).item(literal(1)).$type;

    expect(extractLiteralOptions(union)).toEqual([
      { key: "a", label: "a", value: "a" },
      { key: "1", label: "1", value: 1 },
    ]);
  });

  it("keeps the typed literal on `value` (booleans stay booleans)", () => {
    const union = defineAnnotatedType("union").item(literal(true)).item(literal(false)).$type;
    expect(extractLiteralOptions(union)).toEqual([
      { key: "true", label: "true", value: true },
      { key: "false", label: "false", value: false },
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
      { key: "a", label: "a", value: "a" },
      { key: "b", label: "b", value: "b" },
      { key: "c", label: "c", value: "c" },
    ]);
  });

  it("deduplicates literal values", () => {
    const union = defineAnnotatedType("union")
      .item(literal("a"))
      .item(literal("a"))
      .item(literal("b")).$type;

    expect(extractLiteralOptions(union)).toEqual([
      { key: "a", label: "a", value: "a" },
      { key: "b", label: "b", value: "b" },
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

describe("extractLiteralOptions — @ui.literalLabel", () => {
  it("maps labels per literal; unlabelled literals keep the raw text", async () => {
    const { Ticket } = await import("../__tests__/fixtures/value-help-binding.as");
    const props = (Ticket.type as unknown as { props: Map<string, never> }).props;
    // type-level labels (open, in_progress) and the prop-level one (closed) both apply:
    // the runtime concatenates the referenced type's set with the prop's own, and a later
    // entry for the same literal wins
    expect(extractLiteralOptions(props.get("status")!)).toEqual([
      { key: "open", label: "Open", value: "open" },
      { key: "in_progress", label: "In progress", value: "in_progress" },
      { key: "closed", label: "Done", value: "closed" },
    ]);
    expect(extractLiteralOptions(props.get("plainStatus")!)?.map((o) => o.label)).toEqual([
      "a",
      "b",
    ]);
  });

  it("a prop label overrides the type label of the same literal across a ref", async () => {
    const { Ticket } = await import("../__tests__/fixtures/value-help-binding.as");
    const props = (Ticket.type as unknown as { props: Map<string, never> }).props;
    expect(extractLiteralOptions(props.get("relabelled")!)?.map((o) => [o.key, o.label])).toEqual([
      ["open", "Opened"],
      ["in_progress", "In progress"],
      ["closed", "closed"],
    ]);
  });

  it("type-level labels apply to a prop that does not set its own", async () => {
    const { TicketStatus } = await import("../__tests__/fixtures/value-help-binding.as");
    expect(extractLiteralOptions(TicketStatus as never)?.map((o) => [o.key, o.label])).toEqual([
      ["open", "Open"],
      ["in_progress", "In progress"],
      ["closed", "closed"],
    ]);
  });

  it("reads the serialized form (labels as plain records)", () => {
    const union = defineAnnotatedType("union").item(literal(1)).item(literal(2)).$type;
    union.metadata.set("ui.literalLabel", [{ value: "2", label: "Two" }] as never);
    expect(extractLiteralOptions(union)).toEqual([
      { key: "1", label: "1", value: 1 },
      { key: "2", label: "Two", value: 2 },
    ]);
  });
});
