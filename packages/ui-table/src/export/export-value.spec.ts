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

  it("exports a @ui.valueLabel code with the row's text (since 0.1.190)", () => {
    const c = col({ valueLabel: { path: "office.cityName", arrangement: "keyText" } });
    expect(resolveExportValue("BER", c, { office: { cityName: "Berlin" } })).toBe("BER (Berlin)");
    expect(resolveExportValue(7, c, { office: {} })).toBe("7");
    // without the row: the code
    expect(resolveExportValue("BER", c)).toBe("BER");
  });

  it("labels each element of an array of a union column", () => {
    const c = col({
      options: [
        { key: "a", label: "Active" },
        { key: "b", label: "Blocked" },
      ],
    });
    expect(resolveExportValue(["a", "b", "zzz"], c)).toBe("Active, Blocked, zzz");
    expect(resolveExportValue(["a", "b"])).toBe("a, b");
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
