import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { UI_OPTIONS } from "../shared/annotation-keys";
import { optKey, optLabel, parseStaticOptions, resolveOptions } from "./resolve-options";

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
  it("returns parsed @ui.options when annotation exists", () => {
    const prop = defineAnnotatedType().designType("string").$type;
    prop.metadata.set(
      UI_OPTIONS as keyof AtscriptMetadata,
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
      { key: "a", label: "a" },
      { key: "b", label: "b" },
    ]);
  });

  it("@ui.options wins over literal union extraction", () => {
    const union = defineAnnotatedType("union").item(literal("a")).item(literal("b")).$type;
    union.metadata.set(
      UI_OPTIONS as keyof AtscriptMetadata,
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
