import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { createTableState, type TableStateInternals } from "../composables/use-table-state";
import { useTableQuery, type TableClient } from "../composables/use-table-query";
import type { ReactiveTableState } from "../types";
import { mockColumn, mockTableDef } from "./helpers";

function setupQuery(opts?: { client?: TableClient; debounceMs?: number }) {
  const findManyWithCount = vi.fn().mockResolvedValue({
    data: [{ id: 1 }, { id: 2 }],
    count: 10,
  });

  const client = opts?.client ?? { findManyWithCount };
  let state!: ReactiveTableState;

  mount(
    defineComponent({
      setup() {
        let internals: TableStateInternals;
        ({ state, internals } = createTableState());
        // Initialize with columns so queries have $select
        const cols = [mockColumn("name"), mockColumn("age")];
        internals.init(mockTableDef(cols));

        useTableQuery(client, state, internals, {
          debounceMs: opts?.debounceMs ?? 0, // no debounce in tests
        });
        return () => h("div");
      },
    }),
  );

  return { state, findManyWithCount };
}

describe("useTableQuery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("state.query() triggers a fetch", async () => {
    const { state, findManyWithCount } = setupQuery();

    state.query();
    await flushPromises();

    expect(findManyWithCount).toHaveBeenCalledOnce();
    expect(state.results.value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(state.totalCount.value).toBe(10);
    expect(state.loadedCount.value).toBe(2);
  });

  it("sets queryError on fetch failure", async () => {
    const client = {
      findManyWithCount: vi.fn().mockRejectedValue(new Error("fetch failed")),
    };
    const { state } = setupQuery({ client });

    state.query();
    await flushPromises();

    expect(state.queryError.value).toBeInstanceOf(Error);
    expect(state.queryError.value!.message).toBe("fetch failed");
  });

  it("clears queryError on successful fetch", async () => {
    const findManyWithCount = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ data: [], count: 0 });

    const { state } = setupQuery({ client: { findManyWithCount } });

    state.query();
    await flushPromises();
    expect(state.queryError.value).not.toBeNull();

    state.query();
    await flushPromises();
    expect(state.queryError.value).toBeNull();
  });

  it("passes visible column paths as $select", async () => {
    const { state, findManyWithCount } = setupQuery();

    state.query();
    await flushPromises();

    const query = findManyWithCount.mock.calls[0][0];
    expect(query.controls.$select).toEqual(["name", "age"]);
  });

  it("passes sorters as $sort", async () => {
    const { state, findManyWithCount } = setupQuery();

    state.sorters.value = [{ field: "name", direction: "asc" as const }];
    state.query();
    await flushPromises();

    const query = findManyWithCount.mock.calls[0][0];
    expect(query.controls.$sort).toEqual({ name: 1 });
  });

  it("debounces on filter change", async () => {
    const { state, findManyWithCount } = setupQuery({ debounceMs: 100 });

    // Trigger filter change
    state.filters.value = { name: [{ type: "eq", value: ["test"] }] };

    // Wait for watcher to fire
    await nextTick();

    // Not called yet (debounced)
    expect(findManyWithCount).not.toHaveBeenCalled();

    // Advance past debounce
    vi.advanceTimersByTime(100);
    await flushPromises();

    expect(findManyWithCount).toHaveBeenCalledOnce();
  });
});
