import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { UI_FORM_OPTIONS } from "../shared/annotation-keys";
import {
  optKey,
  optLabel,
  optionLabel,
  parseStaticOptions,
  resolveOptions,
} from "./resolve-options";

// ── Helpers ──────────────────────────────────────────────────

function literal(value: string) {
  return defineAnnotatedType().designType("string").value(value).$type;
}

// ── Tests ────────────────────────────────────────────────────

describe("optKey", () => {
  it("returns string as-is", () => {
    expect(optKey("foo")).toBe("foo");
  });

  it("returns .key from object", () => {
    expect(optKey({ key: "k", label: "L" })).toBe("k");
  });
});

describe("optLabel", () => {
  it("returns string as-is", () => {
    expect(optLabel("foo")).toBe("foo");
  });

  it("returns .label from object", () => {
    expect(optLabel({ key: "k", label: "L" })).toBe("L");
  });
});

describe("parseStaticOptions", () => {
  it("wraps single string into array", () => {
    expect(parseStaticOptions("foo")).toEqual(["foo"]);
  });

  it("passes array of strings through", () => {
    expect(parseStaticOptions(["a", "b"])).toEqual(["a", "b"]);
  });

  it("converts {label, value} objects to {key, label}", () => {
    const raw = [
      { label: "United States", value: "us" },
      { label: "Canada", value: "ca" },
    ];
    expect(parseStaticOptions(raw)).toEqual([
      { key: "us", label: "United States" },
      { key: "ca", label: "Canada" },
    ]);
  });

  it("returns label as string when no value is provided", () => {
    expect(parseStaticOptions([{ label: "Option A" }])).toEqual(["Option A"]);
  });

  it("converts non-string primitives to strings", () => {
    expect(parseStaticOptions([42, true])).toEqual(["42", "true"]);
  });
});

describe("resolveOptions", () => {
  it("returns parsed @ui.form.options when annotation exists", () => {
    const prop = defineAnnotatedType().designType("string").$type;
    prop.metadata.set(
      UI_FORM_OPTIONS as keyof AtscriptMetadata,
      [
        { label: "Yes", value: "y" },
        { label: "No", value: "n" },
      ] as never,
    );

    const result = resolveOptions(prop, {});
    expect(result).toEqual([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
  });

  it("falls back to literal union extraction when no annotation", () => {
    const union = defineAnnotatedType("union").item(literal("a")).item(literal("b")).$type;

    const result = resolveOptions(union, {});
    expect(result).toEqual([
      { key: "a", label: "a", value: "a" },
      { key: "b", label: "b", value: "b" },
    ]);
  });

  it("@ui.form.options wins over literal union extraction", () => {
    const union = defineAnnotatedType("union").item(literal("a")).item(literal("b")).$type;
    union.metadata.set(
      UI_FORM_OPTIONS as keyof AtscriptMetadata,
      [{ label: "Alpha", value: "a" }] as never,
    );

    const result = resolveOptions(union, {});
    expect(result).toEqual([{ key: "a", label: "Alpha" }]);
  });

  it("returns undefined for non-union with no annotation", () => {
    const prop = defineAnnotatedType().designType("string").$type;
    expect(resolveOptions(prop, {})).toBeUndefined();
  });
});

describe("optionLabel", () => {
  const column = {
    options: [
      { key: "open", label: "Open" },
      { key: "1", label: "One" },
      { key: "true", label: "Yes" },
    ],
  };

  it("finds the label by the string form of a string, number or boolean", () => {
    expect(optionLabel(column, "open")).toBe("Open");
    expect(optionLabel(column, 1)).toBe("One");
    expect(optionLabel(column, true)).toBe("Yes");
  });

  it("is undefined for an unknown value, a non-scalar, or a column without options", () => {
    expect(optionLabel(column, "nope")).toBeUndefined();
    expect(optionLabel(column, { a: 1 })).toBeUndefined();
    expect(optionLabel(column, null)).toBeUndefined();
    expect(optionLabel({}, "open")).toBeUndefined();
    expect(optionLabel({ options: [] }, "open")).toBeUndefined();
  });
});

describe("resolveOptions — @ui.literalLabel on an array of a literal union", () => {
  const propsOf = async () => {
    const { Ticket } = await import("../__tests__/fixtures/value-help-binding.as");
    return (Ticket.type as unknown as { props: Map<string, never> }).props;
  };

  it("the array prop's own label wins over the element type's", async () => {
    const props = await propsOf();
    expect(
      resolveOptions(props.get("statuses")!, {})?.map((o) => [optKey(o), optLabel(o)]),
    ).toEqual([
      ["open", "Open"],
      ["in_progress", "In progress"],
      ["closed", "Finished"],
    ]);
  });

  it("without a prop label the element type's labels apply", async () => {
    const props = await propsOf();
    expect(
      resolveOptions(props.get("plainStatuses")!, {})?.map((o) => [optKey(o), optLabel(o)]),
    ).toEqual([
      ["open", "Open"],
      ["in_progress", "In progress"],
      ["closed", "closed"],
    ]);
  });
});
