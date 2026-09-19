import { describe, it, expect } from "vitest";
import type { ColumnDef } from "@atscript/ui";
import { resolveExportValue } from "./export-value";
import { mockColumn } from "../__tests__/helpers";

const col = (overrides: Partial<ColumnDef> = {}) => mockColumn("x", { label: "X", ...overrides });

describe("resolveExportValue", () => {
  it("maps null/undefined to null", () => {
    expect(resolveExportValue(null)).toBeNull();
    expect(resolveExportValue(undefined)).toBeNull();
  });

  it("resolves a union column's option key to its label", () => {
    const c = col({ options: [{ key: "a", label: "Active" }] });
    expect(resolveExportValue("a", c)).toBe("Active");
    expect(resolveExportValue("zzz", c)).toBe("zzz");
  });

  it("keeps numbers and booleans as scalars", () => {
    expect(resolveExportValue(42)).toBe(42);
    expect(resolveExportValue(false)).toBe(false);
  });

  it("renders a Date as ISO 8601", () => {
    expect(resolveExportValue(new Date("2026-01-02T03:04:05.000Z"))).toBe(
      "2026-01-02T03:04:05.000Z",
    );
  });

  it("joins arrays and JSON-encodes objects", () => {
    expect(resolveExportValue(["a", "b"])).toBe("a, b");
    expect(resolveExportValue({ a: 1 })).toBe('{"a":1}');
  });
});
