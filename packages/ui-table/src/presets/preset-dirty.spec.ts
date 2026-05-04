import { describe, expect, it } from "vitest";
import { isDirtyAgainst, stableStringify } from "./preset-dirty";
import type { PresetSnapshot } from "./preset-types";

describe("stableStringify", () => {
  it("sorts object keys at every depth", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify({ x: { z: 1, a: 2 } })).toBe(stableStringify({ x: { a: 2, z: 1 } }));
  });

  it("preserves array order", () => {
    expect(stableStringify([3, 1, 2])).not.toBe(stableStringify([1, 2, 3]));
  });

  it("handles primitives, null, undefined", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(undefined)).toBe(undefined as unknown as string);
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify("foo")).toBe('"foo"');
  });

  it("normalises columnWidths dicts regardless of insertion order", () => {
    const a = { columns: { columnNames: ["x"], columnWidths: { b: "10px", a: "5px" } } };
    const b = { columns: { columnNames: ["x"], columnWidths: { a: "5px", b: "10px" } } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });
});

describe("isDirtyAgainst", () => {
  it("returns false when active claims no aspects", () => {
    const active: PresetSnapshot = {};
    const current: PresetSnapshot = {
      columns: { columnNames: ["x"] },
      filters: ["status"],
      sorters: [{ field: "createdAt", direction: "desc" }],
    };
    expect(isDirtyAgainst(active, current)).toBe(false);
  });

  it("column-only preset stays clean while filters change", () => {
    const active: PresetSnapshot = { columns: { columnNames: ["a", "b"] } };
    const current: PresetSnapshot = {
      columns: { columnNames: ["a", "b"] },
      filters: ["status"],
      filterOps: { status: [{ type: "eq", value: ["active"] }] },
    };
    expect(isDirtyAgainst(active, current)).toBe(false);
  });

  it("column-only preset goes dirty when its claimed aspect changes", () => {
    const active: PresetSnapshot = { columns: { columnNames: ["a", "b"] } };
    const current: PresetSnapshot = { columns: { columnNames: ["a", "b", "c"] } };
    expect(isDirtyAgainst(active, current)).toBe(true);
  });

  it("filterOps-only preset doesn't dirty when columns reorder", () => {
    const active: PresetSnapshot = {
      filterOps: { status: [{ type: "eq", value: ["active"] }] },
    };
    const current: PresetSnapshot = {
      filterOps: { status: [{ type: "eq", value: ["active"] }] },
      columns: { columnNames: ["a", "b"] },
    };
    expect(isDirtyAgainst(active, current)).toBe(false);
  });

  it("detects sorters change when claimed", () => {
    const active: PresetSnapshot = {
      sorters: [{ field: "name", direction: "asc" }],
    };
    const current: PresetSnapshot = {
      sorters: [{ field: "name", direction: "desc" }],
    };
    expect(isDirtyAgainst(active, current)).toBe(true);
  });

  it("detects itemsPerPage change when claimed", () => {
    const active: PresetSnapshot = { itemsPerPage: 25 };
    const current: PresetSnapshot = { itemsPerPage: 50 };
    expect(isDirtyAgainst(active, current)).toBe(true);
  });

  it("treats columnWidths reorder as equal (stable stringify)", () => {
    const active: PresetSnapshot = {
      columns: { columnNames: ["a", "b"], columnWidths: { a: "100px", b: "200px" } },
    };
    const current: PresetSnapshot = {
      columns: { columnNames: ["a", "b"], columnWidths: { b: "200px", a: "100px" } },
    };
    expect(isDirtyAgainst(active, current)).toBe(false);
  });

  it("treats filterOps key reorder as equal (stable stringify)", () => {
    const active: PresetSnapshot = {
      filterOps: {
        status: [{ type: "eq", value: ["active"] }],
        priority: [{ type: "gt", value: [5] }],
      },
    };
    const current: PresetSnapshot = {
      filterOps: {
        priority: [{ type: "gt", value: [5] }],
        status: [{ type: "eq", value: ["active"] }],
      },
    };
    expect(isDirtyAgainst(active, current)).toBe(false);
  });
});
