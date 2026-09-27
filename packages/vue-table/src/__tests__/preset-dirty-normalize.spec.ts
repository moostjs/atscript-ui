import { describe, expect, it } from "vitest";
import { computed, ref, shallowRef } from "vue";
import type { ColumnDef, PaginationControl, SortControl } from "@atscript/ui";
import {
  type ColumnWidthsMap,
  type FieldFilters,
  type PresetAspect,
  type PresetSnapshot,
  resolveSystemPresets,
} from "@atscript/ui-table";
import { createPresetState } from "../composables/state/create-preset-state";
import { mockColumn } from "./helpers";

// Regression: a preset spelling out a width equal to the column's default, or
// a filter entry with nothing filled, was dirty the moment it was applied (or
// the moment the user cleared that field) — capture never writes either.
function setup(content: PresetSnapshot, withKnown = true) {
  const columns: ColumnDef[] = [mockColumn("name", { width: "10em" }), mockColumn("status")];
  const o = {
    columnNames: shallowRef<string[]>(["name", "status"]),
    columnWidths: ref<ColumnWidthsMap>({
      name: { w: "10em", d: "10em" },
      status: { w: "200px", d: "200px" },
    }),
    filterFields: shallowRef<string[]>([]),
    filters: shallowRef<FieldFilters>({}),
    sorters: shallowRef<SortControl[]>([]),
    pagination: ref<PaginationControl>({ page: 1, itemsPerPage: 25 }),
    allColumns: shallowRef<ColumnDef[]>(columns),
    fallbackSystemPresets: resolveSystemPresets([{ id: "p", label: "P", content }]),
    availableAspects: ["columns", "filters", "filterOps", "sorters"] as PresetAspect[],
    knownFields: withKnown
      ? computed(() => ({
          columns: new Set(["name", "status"]),
          server: new Set(["name", "status"]),
        }))
      : undefined,
  };
  const { slice } = createPresetState(o);
  slice.apply("sys:p");
  return { slice, o };
}

const cols = (columnWidths?: Record<string, string>) => ({
  columns: { columnNames: ["name", "status"], columnWidths },
});

// Unit cases for the canonical form live with `canonicalPresetSnapshot` in
// ui-table; these cover the wiring, one per rule.
describe("preset dirty — default-equivalent content", () => {
  for (const withKnown of [true, false]) {
    it(`a preset width equal to the column default is clean (knownFields: ${withKnown})`, () => {
      const { slice } = setup(cols({ name: "10em" }), withKnown);
      expect(slice.isDirty.value).toBe(false);
    });
  }

  it("resizing away from a default-equal preset width is dirty, back is clean", () => {
    const { slice, o } = setup(cols({ name: "10em" }));
    o.columnWidths.value = { ...o.columnWidths.value, name: { w: "14em", d: "10em" } };
    expect(slice.isDirty.value).toBe(true);
    o.columnWidths.value = { ...o.columnWidths.value, name: { w: "10em", d: "10em" } };
    expect(slice.isDirty.value).toBe(false);
  });

  it("a filter field with nothing filled is not applied, and clearing it again is clean", () => {
    const { slice, o } = setup({
      filters: ["name"],
      filterOps: { name: [], status: [{ type: "eq", value: [""] }] },
    });
    // Apply writes the shape table state holds.
    expect(o.filters.value).toEqual({});
    expect(slice.isDirty.value).toBe(false);
    o.filters.value = { name: [{ type: "contains", value: ["x"] }] };
    expect(slice.isDirty.value).toBe(true);
    o.filters.value = {};
    expect(slice.isDirty.value).toBe(false);
  });

  it("activeSnapshot is canonical; the stored preset is untouched", () => {
    const { slice } = setup(cols({ name: "10em" }));
    expect(slice.activeSnapshot.value.columns).toEqual({ columnNames: ["name", "status"] });
    expect(slice.systemPresetsById.value.get("sys:p")?.content.columns?.columnWidths).toEqual({
      name: "10em",
    });
  });
});
