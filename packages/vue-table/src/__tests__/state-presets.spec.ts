import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { mockColumn, mountTableState } from "./helpers";

describe("ReactiveTableState — preset surface (no presetsHandle)", () => {
  it("exposes default Standard system preset and presetsAvailable=false", () => {
    const { state } = mountTableState();
    expect(state.preset.systemPresets.value).toHaveLength(1);
    expect(state.preset.systemPresets.value[0].id).toBe("sys:standard");
    expect(state.preset.available.value).toBe(false);
    expect(state.preset.activeId.value).toBeNull();
    expect(state.preset.presets.value).toEqual([]);
    expect(state.preset.userConf.value).toBeNull();
  });

  it("captureSnapshot reads state, gated by availablePresetAspects", () => {
    const { state } = mountTableState({
      columns: [mockColumn("name"), mockColumn("status")],
    });
    state.columnNames.value = ["name", "status"];
    state.filterFields.value = ["status"];
    state.filters.value = { status: [{ type: "eq", value: ["active"] }] };
    state.sorters.value = [{ field: "name", direction: "asc" }];

    const snap = state.preset.captureSnapshot();
    expect(snap).toEqual({
      columns: { columnNames: ["name", "status"] },
      filters: ["status"],
      filterOps: { status: [{ type: "eq", value: ["active"] }] },
      sorters: [{ field: "name", direction: "asc" }],
    });
    // itemsPerPage NOT included (default availableAspects excludes it).
    expect(snap.itemsPerPage).toBeUndefined();
  });

  it("captureSnapshot mask intersects with availablePresetAspects", () => {
    const { state } = mountTableState({
      columns: [mockColumn("name")],
    });
    state.columnNames.value = ["name"];
    state.sorters.value = [{ field: "name", direction: "asc" }];

    // Request only sorters.
    const snap = state.preset.captureSnapshot({ sorters: true });
    expect(snap).toEqual({ sorters: [{ field: "name", direction: "asc" }] });
  });

  it("applyPreset is pure batched mutation — does NOT call query()", async () => {
    const { state, pagesFn } = mountTableState({
      columns: [mockColumn("name"), mockColumn("status"), mockColumn("priority")],
      queryOnMount: false,
    });
    state.columnNames.value = ["name"];

    const callsBefore = pagesFn.mock.calls.length;
    state.preset.apply({
      columns: { columnNames: ["status", "priority"] },
      filters: ["status"],
    });
    await nextTick();

    expect(state.columnNames.value).toEqual(["status", "priority"]);
    expect(state.filterFields.value).toEqual(["status"]);
    // No direct query() invocation — root watcher reacts on its own schedule.
    expect(pagesFn.mock.calls.length).toBe(callsBefore);
  });

  it("applyPreset writes only the aspects the preset claims (per-aspect apply)", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("a"), mockColumn("b")],
    });
    state.columnNames.value = ["a", "b"];
    state.filterFields.value = ["a"];
    state.sorters.value = [{ field: "a", direction: "desc" }];

    // Column-only preset: filters + sorters must NOT be touched.
    state.preset.apply({ columns: { columnNames: ["b"] } });
    await nextTick();

    expect(state.columnNames.value).toEqual(["b"]);
    expect(state.filterFields.value).toEqual(["a"]);
    expect(state.sorters.value).toEqual([{ field: "a", direction: "desc" }]);
  });

  // Applying a system preset whose `columns` aspect declares no explicit
  // `columnNames` (the default Standard preset, content `{}`) falls back to
  // ALL columns. Field exclusion (`@ui.table.exclude`) happens upstream in
  // `@atscript/ui` — excluded fields are never pushed as columns, so every
  // column the table knows about is part of the fallback set.
  it("applyPreset(sys:standard) with empty content falls back to all columns", async () => {
    const { state } = mountTableState({
      columns: [mockColumn("name"), mockColumn("status"), mockColumn("notes")],
    });
    state.preset.apply("sys:standard");
    await nextTick();
    expect(state.columnNames.value).toEqual(["name", "status", "notes"]);
  });

  it("expandDefault for columns is all columns (snapshot expansion path)", () => {
    const { state } = mountTableState({
      columns: [mockColumn("name"), mockColumn("status")],
    });
    state.preset.activeId.value = "sys:standard";
    // activeSnapshot expands the empty `{}` system preset via
    // `expandDefault` per aspect; isDirty compares it against current state.
    // After applying Standard, no aspect should be dirty against the
    // expanded default (which is the full column set).
    state.preset.apply("sys:standard");
    expect(state.preset.isDirty.value).toBe(false);
    expect(state.columnNames.value).toEqual(["name", "status"]);
  });

  it("isDirty defaults to false when no active preset is set", () => {
    const { state } = mountTableState();
    expect(state.preset.activeId.value).toBeNull();
    expect(state.preset.isDirty.value).toBe(false);
  });

  it("canSaveActive is false for system presets", async () => {
    const { state } = mountTableState();
    state.preset.activeId.value = "sys:standard";
    await nextTick();
    expect(state.preset.canSaveActive.value).toBe(false);
  });

  it("save / saveAs / etc. throw when presets feature is not configured", async () => {
    const { state } = mountTableState();
    await expect(state.preset.saveActive()).rejects.toThrow(/presets feature/);
    await expect(state.preset.saveAs("X")).rejects.toThrow(/presets feature/);
    await expect(state.preset.rename("p1", "X")).rejects.toThrow(/presets feature/);
    await expect(state.preset.remove("p1")).rejects.toThrow(/presets feature/);
    await expect(state.preset.togglePublic("p1")).rejects.toThrow(/presets feature/);
    await expect(state.preset.setDefault(null)).rejects.toThrow(/presets feature/);
    await expect(state.preset.toggleFav("p1")).rejects.toThrow(/presets feature/);
  });

  it("clearLocalDraft is a no-op when persistence is off", () => {
    const { state } = mountTableState();
    expect(() => state.preset.clearLocalDraft()).not.toThrow();
  });
});
