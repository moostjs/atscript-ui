import { describe, expect, it } from "vitest";
import { ref, shallowRef } from "vue";
import type { ColumnDef, PaginationControl, SortControl } from "@atscript/ui";
import {
  type ColumnWidthsMap,
  type FieldFilters,
  type SystemPreset,
  resolveSystemPresets,
} from "@atscript/ui-table";
import {
  createPresetState,
  type CreatePresetStateOptions,
} from "../composables/state/create-preset-state";
import { mockColumn } from "./helpers";

// Regression: every system preset used to be treated as owning every
// available aspect, so applying a filter-only system view reset the user's
// columns, widths, displayed filters, sorters and page size.
const SYSTEM_PRESETS: SystemPreset[] = resolveSystemPresets([
  { id: "open", label: "Open", content: { filterOps: { status: [{ type: "eq", value: ["o"] }] } } },
  {
    id: "closed",
    label: "Closed",
    content: { filterOps: { status: [{ type: "eq", value: ["c"] }] } },
  },
]);

function setup(systemAspects?: CreatePresetStateOptions["systemAspects"]) {
  const columns: ColumnDef[] = [mockColumn("name"), mockColumn("status"), mockColumn("total")];
  const o = {
    columnNames: shallowRef<string[]>(["name", "status", "total"]),
    columnWidths: ref<ColumnWidthsMap>({ name: { w: "12rem", d: "8rem" } }),
    filterFields: shallowRef<string[]>(["status", "total"]),
    filters: shallowRef<FieldFilters>({}),
    sorters: shallowRef<SortControl[]>([{ field: "total", direction: "desc" }]),
    pagination: ref<PaginationControl>({ page: 1, itemsPerPage: 25 }),
    allColumns: shallowRef<ColumnDef[]>(columns),
    fallbackSystemPresets: SYSTEM_PRESETS,
    availableAspects: ["columns", "filters", "filterOps", "sorters"] as const,
    systemAspects,
  } satisfies Partial<CreatePresetStateOptions> as unknown as CreatePresetStateOptions;
  const { slice } = createPresetState(o);
  return { slice, o };
}

describe("preset systemAspects", () => {
  it("defaults to availableAspects — a system preset still owns everything", () => {
    const { slice, o } = setup();
    expect(slice.systemAspects).toEqual(slice.availableAspects);

    o.columnNames.value = ["status"];
    slice.apply("sys:open");

    // Unchanged behaviour: the system preset resets the layout aspects too.
    expect(o.columnNames.value).toEqual(["name", "status", "total"]);
    expect(o.sorters.value).toEqual([]);
  });

  it("with systemAspects=['filterOps'], switching system views preserves layout", () => {
    const { slice, o } = setup(["filterOps"]);
    expect(slice.systemAspects).toEqual(["filterOps"]);

    o.columnNames.value = ["status", "name"];
    o.columnWidths.value = { name: { w: "20rem", d: "8rem" } };
    o.filterFields.value = ["status"];
    o.sorters.value = [{ field: "name", direction: "asc" }];
    o.pagination.value = { page: 1, itemsPerPage: 100 };

    slice.apply("sys:open");
    expect(o.filters.value).toEqual({ status: [{ type: "eq", value: ["o"] }] });

    slice.apply("sys:closed");
    expect(o.filters.value).toEqual({ status: [{ type: "eq", value: ["c"] }] });

    // Everything the system presets do NOT own survives both switches.
    expect(o.columnNames.value).toEqual(["status", "name"]);
    expect(o.columnWidths.value).toEqual({ name: { w: "20rem", d: "8rem" } });
    expect(o.filterFields.value).toEqual(["status"]);
    expect(o.sorters.value).toEqual([{ field: "name", direction: "asc" }]);
    expect(o.pagination.value.itemsPerPage).toBe(100);
  });

  it("the dirty baseline of a system preset ignores non-system aspects", () => {
    const { slice, o } = setup(["filterOps"]);
    slice.apply("sys:open");
    expect(slice.isDirty.value).toBe(false);

    // Reordering columns is not the system preset's business → still clean.
    o.columnNames.value = ["total", "name", "status"];
    o.sorters.value = [];
    expect(slice.isDirty.value).toBe(false);
    expect(slice.activeSnapshot.value).toEqual({
      filterOps: { status: [{ type: "eq", value: ["o"] }] },
    });

    // Changing the aspect it DOES own dirties it.
    o.filters.value = {};
    expect(slice.isDirty.value).toBe(true);
  });

  it("a user preset still owns every aspect its snapshot claims", () => {
    const { slice, o } = setup(["filterOps"]);
    o.columnNames.value = ["status"];
    slice.apply({ columns: { columnNames: ["name", "total"] }, sorters: [] });
    expect(o.columnNames.value).toEqual(["name", "total"]);
    expect(o.sorters.value).toEqual([]);
  });

  it("intersects systemAspects with availableAspects", () => {
    const { slice } = setup(["filterOps", "itemsPerPage"]);
    expect(slice.systemAspects).toEqual(["filterOps"]);
  });
});

// Regression (finding 24): a snapshot whose `filterOps` is explicitly empty
// owns the aspect and must CLEAR the active filters; one without the key
// leaves them alone.
describe("empty owned aspects on apply", () => {
  it("applies an explicitly empty filterOps as a clear", () => {
    const { slice, o } = setup();
    o.filters.value = { status: [{ type: "eq", value: ["x"] }] };
    slice.apply({ filterOps: {} });
    expect(o.filters.value).toEqual({});
  });

  it("leaves filters alone when the snapshot has no filterOps key", () => {
    const { slice, o } = setup();
    o.filters.value = { status: [{ type: "eq", value: ["x"] }] };
    slice.apply({ columns: { columnNames: ["name"] } });
    expect(o.filters.value).toEqual({ status: [{ type: "eq", value: ["x"] }] });
  });
});

// Regression (finding 26): mutators used to fail silently — the slice had no
// error state at all and consumers had nothing to render.
describe("preset mutator error state", () => {
  it("records lastError and rethrows", async () => {
    const { slice } = setup();
    expect(slice.lastError.value).toBeNull();

    await expect(slice.saveAs("X")).rejects.toThrow(/presets feature/);

    expect(slice.lastError.value).toBeInstanceOf(Error);
    expect(slice.lastError.value?.message).toMatch(/presets feature/);
  });

  it("clears lastError when the next OUTERMOST mutator starts", async () => {
    const { slice } = setup();
    await expect(slice.rename("p1", "X")).rejects.toThrow();
    expect(slice.lastError.value).not.toBeNull();

    const next = slice.remove("p1").catch(() => {});
    // Cleared synchronously at the start of the call.
    expect(slice.lastError.value).toBeNull();
    await next;
  });

  it("keeps a failure raised inside a batch: the batch is one error frame", async () => {
    const { slice } = setup();
    await slice
      .batch(async () => {
        // Two failing writes, each caught by the caller the way the manage
        // dialog catches them — the first must not be wiped by the second's
        // fresh start, and the LAST failure is what remains.
        await slice.rename("p1", "X").catch(() => {});
        await slice.togglePublic("p2").catch(() => {});
      })
      .catch(() => {});

    expect(slice.lastError.value).toBeInstanceOf(Error);
  });

  it("a successful write inside a batch does not wipe an earlier failure", async () => {
    const { slice } = setup();
    await slice
      .batch(async () => {
        await slice.rename("p1", "X").catch(() => {});
        // `apply` is not a tracked mutator, but a nested tracked call that
        // SUCCEEDS must not clear the recorded failure either.
        await slice.batch(async () => {});
      })
      .catch(() => {});

    expect(slice.lastError.value).toBeInstanceOf(Error);
  });
});
