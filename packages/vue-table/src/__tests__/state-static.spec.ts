import { describe, it, expect } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { createStaticTableState } from "../composables/use-table-state";
import type { ReactiveTableState } from "../types";
import { mockColumn, mountSetup } from "./helpers";

function setupStatic(rows: Record<string, unknown>[], searchPaths?: string[]): ReactiveTableState {
  return mountSetup(() => {
    const { state } = createStaticTableState({
      rows,
      columns: [mockColumn("label", { sortable: true, filterable: false })],
      searchPaths,
      selection: { mode: "multi", rowValueFn: (r) => r.id },
    });
    return state;
  });
}

describe("createStaticTableState", () => {
  it("populates tableDef synchronously without a network fetcher", () => {
    const state = setupStatic([{ id: "a", label: "Alpha" }]);
    expect(state.loadingMetadata.value).toBe(false);
    expect(state.tableDef.value).not.toBeNull();
    expect(state.tableDef.value?.columns).toHaveLength(1);
  });

  it("produces results + windowCache from in-memory rows on the bootstrap query", async () => {
    const data = [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Bravo" },
      { id: "c", label: "Charlie" },
    ];
    const state = setupStatic(data);
    await flushPromises();
    expect(state.totalCount.value).toBe(3);
    expect(state.results.value).toHaveLength(3);
    expect(state.windowCache.value.size).toBe(3);
    expect(state.querying.value).toBe(false);
  });

  it("filters by searchTerm against searchPaths (substring, case-insensitive)", async () => {
    const data = [
      { id: "a", label: "Apple" },
      { id: "b", label: "Banana" },
      { id: "c", label: "apricot" },
    ];
    const state = setupStatic(data, ["label"]);
    await flushPromises();
    expect(state.totalCount.value).toBe(3);

    state.searchTerm.value = "ap";
    // Search is debounced (500ms) — trigger an immediate query for the test
    // instead of advancing fake timers; the static fetcher reads
    // `searchTerm.value` directly.
    state.query();
    await flushPromises();
    expect(state.totalCount.value).toBe(2);
    expect((state.results.value[0] as Record<string, unknown>).label).toBe("Apple");
  });

  it("sorts by sorter direction (asc/desc) on the static dataset", async () => {
    const data = [
      { id: "c", label: "Charlie" },
      { id: "a", label: "Alpha" },
      { id: "b", label: "Bravo" },
    ];
    const state = setupStatic(data);
    await flushPromises();

    state.sorters.value = [{ field: "label", direction: "asc" }];
    await flushPromises();
    expect(state.results.value.map((r) => (r as Record<string, unknown>).id)).toEqual([
      "a",
      "b",
      "c",
    ]);

    state.sorters.value = [{ field: "label", direction: "desc" }];
    await flushPromises();
    expect(state.results.value.map((r) => (r as Record<string, unknown>).id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("respects no client and never throws", async () => {
    const state = setupStatic([{ id: "a", label: "Alpha" }]);
    await flushPromises();
    expect(state.queryError.value).toBeNull();
  });
});
