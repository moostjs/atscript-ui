import { describe, expect, it } from "vitest";
import type { ColumnDef } from "@atscript/ui-core";
import { deserializePreset, serializePreset } from "./preset-serializer";
import type { FieldFilters } from "../filters/filter-types";
import type { PresetSnapshot } from "./preset-types";

function makeColumn(path: string): ColumnDef {
  return {
    path,
    label: path,
    type: "text",
    sortable: true,
    filterable: true,
    visible: true,
    order: 0,
  };
}

describe("serializePreset", () => {
  it("serializes visible columns as paths", () => {
    const columns = [makeColumn("name"), makeColumn("email"), makeColumn("age")];
    const snapshot = serializePreset(columns, [], {});
    expect(snapshot.columns).toEqual(["name", "email", "age"]);
  });

  it("includes sorters when present", () => {
    const sorters = [{ field: "name", direction: "asc" as const }];
    const snapshot = serializePreset([], sorters, {});
    expect(snapshot.sorters).toEqual(sorters);
  });

  it("omits sorters when empty", () => {
    const snapshot = serializePreset([], [], {});
    expect(snapshot.sorters).toBeUndefined();
  });

  it("includes filters when present", () => {
    const filters: FieldFilters = {
      status: [{ type: "eq", value: ["active"] }],
    };
    const snapshot = serializePreset([], [], filters);
    expect(snapshot.filters).toEqual(filters);
  });

  it("omits filters when empty", () => {
    const snapshot = serializePreset([], [], {});
    expect(snapshot.filters).toBeUndefined();
  });

  it("includes itemsPerPage when provided", () => {
    const snapshot = serializePreset([], [], {}, 25);
    expect(snapshot.itemsPerPage).toBe(25);
  });

  it("omits itemsPerPage when undefined", () => {
    const snapshot = serializePreset([], [], {});
    expect(snapshot.itemsPerPage).toBeUndefined();
  });
});

describe("deserializePreset", () => {
  it("restores columns", () => {
    const snapshot: PresetSnapshot = { columns: ["name", "email"] };
    const result = deserializePreset(snapshot);
    expect(result.columns).toEqual(["name", "email"]);
  });

  it("defaults sorters to empty array when missing", () => {
    const snapshot: PresetSnapshot = {};
    const result = deserializePreset(snapshot);
    expect(result.sorters).toEqual([]);
  });

  it("defaults filters to empty object when missing", () => {
    const snapshot: PresetSnapshot = {};
    const result = deserializePreset(snapshot);
    expect(result.filters).toEqual({});
  });

  it("returns undefined columns when not in snapshot", () => {
    const snapshot: PresetSnapshot = {};
    const result = deserializePreset(snapshot);
    expect(result.columns).toBeUndefined();
  });

  it("restores itemsPerPage", () => {
    const snapshot: PresetSnapshot = { itemsPerPage: 50 };
    const result = deserializePreset(snapshot);
    expect(result.itemsPerPage).toBe(50);
  });
});

describe("roundtrip", () => {
  it("serialize then deserialize preserves data", () => {
    const columns = [makeColumn("name"), makeColumn("email")];
    const sorters = [
      { field: "name", direction: "asc" as const },
      { field: "email", direction: "desc" as const },
    ];
    const filters: FieldFilters = {
      status: [{ type: "eq", value: ["active"] }],
      age: [{ type: "gt", value: [18] }],
    };

    const snapshot = serializePreset(columns, sorters, filters, 25);
    const restored = deserializePreset(snapshot);

    expect(restored.columns).toEqual(["name", "email"]);
    expect(restored.sorters).toEqual(sorters);
    expect(restored.filters).toEqual(filters);
    expect(restored.itemsPerPage).toBe(25);
  });

  it("roundtrip through JSON preserves data", () => {
    const columns = [makeColumn("name")];
    const sorters = [{ field: "name", direction: "desc" as const }];
    const filters: FieldFilters = {
      name: [
        { type: "contains", value: ["test"] },
        { type: "ne", value: ["admin"] },
      ],
    };

    const snapshot = serializePreset(columns, sorters, filters, 100);
    const json = JSON.stringify(snapshot);
    const parsed = JSON.parse(json) as PresetSnapshot;
    const restored = deserializePreset(parsed);

    expect(restored.columns).toEqual(["name"]);
    expect(restored.sorters).toEqual(sorters);
    expect(restored.filters).toEqual(filters);
    expect(restored.itemsPerPage).toBe(100);
  });
});
