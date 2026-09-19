import { describe, expect, it } from "vitest";

import type { PresetSnapshot } from "./preset-types";
import { fromWireSnapshot, toWireSnapshot } from "./preset-wire";

// Regression: the wire helpers used to drop explicitly EMPTY aspects
// (`filterOps: {}`, `columnWidths: {}`), collapsing "this preset owns the
// aspect and it is empty" into "this preset does not claim the aspect" — so a
// saved unfiltered view failed to clear the previous filters on apply.
describe("preset wire round-trip", () => {
  const cases: Record<string, PresetSnapshot> = {
    empty: {},
    "empty filterOps": { filterOps: {} },
    "populated filterOps": { filterOps: { status: [{ op: "eq", value: "active" }] } as never },
    "empty filters": { filters: [] },
    "populated filters": { filters: ["status", "total"] },
    "empty sorters": { sorters: [] },
    "populated sorters": { sorters: [{ field: "total", desc: true }] as never },
    "columns without widths": { columns: { columnNames: ["a", "b"] } },
    "columns with empty widths": { columns: { columnNames: ["a"], columnWidths: {} } },
    "columns with widths": { columns: { columnNames: ["a"], columnWidths: { a: "10rem" } } },
    itemsPerPage: { itemsPerPage: 50 },
    "every aspect at once": {
      columns: { columnNames: ["a"], columnWidths: {} },
      filters: [],
      filterOps: {},
      sorters: [],
      itemsPerPage: 25,
    },
  };

  for (const [name, snapshot] of Object.entries(cases)) {
    it(`preserves "${name}" through toWire → fromWire`, () => {
      expect(fromWireSnapshot(toWireSnapshot(snapshot))).toEqual(snapshot);
    });
  }

  it("keeps an empty owned aspect distinguishable from an absent one", () => {
    expect(toWireSnapshot({ filterOps: {} }).filterOps).toEqual([]);
    expect(toWireSnapshot({}).filterOps).toBeUndefined();
    expect(fromWireSnapshot({ filterOps: [] }).filterOps).toEqual({});
    expect(fromWireSnapshot({}).filterOps).toBeUndefined();

    expect(toWireSnapshot({ columns: { columnNames: [], columnWidths: {} } }).columns).toEqual({
      columnNames: [],
      columnWidths: [],
    });
    expect(toWireSnapshot({ columns: { columnNames: [] } }).columns).toEqual({ columnNames: [] });
  });

  it("sorts entries-arrays by field", () => {
    const wire = toWireSnapshot({
      columns: { columnNames: ["b", "a"], columnWidths: { b: "2rem", a: "1rem" } },
    });
    expect(wire.columns?.columnWidths?.map((e) => e.field)).toEqual(["a", "b"]);
  });
});
