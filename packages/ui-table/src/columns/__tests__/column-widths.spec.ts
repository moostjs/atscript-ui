import { describe, it, expect } from "vitest";
import type { ColumnDef } from "@atscript/ui";
import {
  MAX_DEFAULT_COLUMN_WIDTH_PX,
  computeDefaultColumnWidth,
  reconcileColumnWidthDefaults,
} from "../column-widths";

function col(overrides: Partial<ColumnDef> & { path: string; type: string }): ColumnDef {
  return {
    label: overrides.path,
    sortable: true,
    filterable: true,
    visible: true,
    order: 0,
    ...overrides,
  };
}

describe("computeDefaultColumnWidth", () => {
  it("honours @ui.field.width annotation as-is (uncapped)", () => {
    expect(computeDefaultColumnWidth(col({ path: "a", type: "text", width: "500px" }))).toBe(
      "500px",
    );
    expect(computeDefaultColumnWidth(col({ path: "a", type: "text", width: "30em" }))).toBe("30em");
  });

  it("returns narrow defaults for boolean/number", () => {
    expect(computeDefaultColumnWidth(col({ path: "a", type: "boolean" }))).toBe("64px");
    expect(computeDefaultColumnWidth(col({ path: "a", type: "number" }))).toBe("96px");
  });

  it("uses generous defaults for ref / array / object", () => {
    expect(computeDefaultColumnWidth(col({ path: "a", type: "ref" }))).toBe("200px");
    expect(computeDefaultColumnWidth(col({ path: "a", type: "array" }))).toBe("240px");
    expect(computeDefaultColumnWidth(col({ path: "a", type: "object" }))).toBe("240px");
  });

  it("derives text width from @expect.maxLength when present", () => {
    // Math: 20 * 8 + 32 = 192 → "192px"
    expect(computeDefaultColumnWidth(col({ path: "a", type: "text", maxLen: 20 }))).toBe("192px");
    // Cap kicks in well before maxLen runs away.
    expect(computeDefaultColumnWidth(col({ path: "a", type: "text", maxLen: 1000 }))).toBe(
      `${MAX_DEFAULT_COLUMN_WIDTH_PX}px`,
    );
    // Tiny maxLen still meets the 96px floor.
    expect(computeDefaultColumnWidth(col({ path: "a", type: "text", maxLen: 1 }))).toBe("96px");
  });

  it("falls back to a 200px text default when no maxLen", () => {
    expect(computeDefaultColumnWidth(col({ path: "a", type: "text" }))).toBe("200px");
  });

  it("uses option-label length for enum when options are present", () => {
    const c = col({
      path: "a",
      type: "enum",
      options: [
        { key: "1", label: "short" },
        { key: "2", label: "this-is-the-longest-option-label" },
      ],
    });
    // 32 chars * 8 + 48 = 304 (under cap)
    expect(computeDefaultColumnWidth(c)).toBe("304px");
  });

  it("falls back to 160px enum default when options are missing", () => {
    expect(computeDefaultColumnWidth(col({ path: "a", type: "enum" }))).toBe("160px");
  });

  it("falls back to 160px for unknown types", () => {
    expect(computeDefaultColumnWidth(col({ path: "a", type: "weird-future-type" }))).toBe("160px");
  });
});

describe("reconcileColumnWidthDefaults", () => {
  it("seeds `{ w: d, d }` for every column when current is empty", () => {
    const cols = [col({ path: "a", type: "boolean" }), col({ path: "b", type: "text" })];
    const result = reconcileColumnWidthDefaults(cols, {});
    expect(result).toEqual({
      a: { w: "64px", d: "64px" },
      b: { w: "200px", d: "200px" },
    });
  });

  it("preserves manual `w` while refreshing `d` when the default has changed", () => {
    const cols = [col({ path: "a", type: "text", maxLen: 30 })]; // d = 272px
    const current = { a: { w: "999px", d: "200px" } };
    const result = reconcileColumnWidthDefaults(cols, current);
    expect(result).toEqual({ a: { w: "999px", d: "272px" } });
  });

  it("returns the same reference when nothing needs to change", () => {
    const cols = [col({ path: "a", type: "boolean" })];
    const current = { a: { w: "64px", d: "64px" } };
    const result = reconcileColumnWidthDefaults(cols, current);
    expect(result).toBe(current);
  });

  it("keeps stale entries for paths no longer in allColumns (reappearance preserves user width)", () => {
    const cols = [col({ path: "a", type: "boolean" })];
    const current = {
      a: { w: "64px", d: "64px" },
      removed: { w: "300px", d: "200px" },
    };
    const result = reconcileColumnWidthDefaults(cols, current);
    expect(result.removed).toEqual({ w: "300px", d: "200px" });
  });
});
