import { describe, it, expect, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mockColumn, mountTableState } from "./helpers";

function setup(overrides?: {
  data?: Record<string, unknown>[];
  count?: number;
  pages?: ReturnType<typeof vi.fn>;
  blockQuery?: boolean;
}) {
  return mountTableState({
    columns: [mockColumn("name"), mockColumn("age")],
    data: overrides?.data,
    count: overrides?.count,
    pages: overrides?.pages,
    blockQuery: overrides?.blockQuery,
  });
}

describe("state.query()", () => {
  it("does NOT pre-wipe results before response", async () => {
    let resolveFetch!: (v: { data: unknown[]; count: number }) => void;
    const slowFetch = vi.fn(
      () =>
        new Promise<{
          data: unknown[];
          count: number;
          page: number;
          itemsPerPage: number;
          pages: number;
        }>((res) => {
          resolveFetch = (v) => res({ ...v, page: 1, itemsPerPage: 50, pages: 1 } as never);
        }),
    );
    const { state } = setup({ pages: slowFetch });

    state.results.value = [{ id: 99 }];
    state.windowCache.value = new Map([[0, { id: 99 }]]);

    state.query();
    await flushPromises();
    // Mid-flight: prior data still visible.
    expect(state.results.value).toEqual([{ id: 99 }]);
    expect(state.windowCache.value.size).toBe(1);
    expect(state.querying.value).toBe(true);
    expect(state.windowLoading.value.size).toBe(0);

    resolveFetch({ data: [{ id: 1 }, { id: 2 }], count: 10 });
    await flushPromises();
    expect(state.querying.value).toBe(false);
  });

  it("atomically swaps on response", async () => {
    const { state } = setup();
    state.query();
    await flushPromises();
    expect(state.results.value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(state.windowCache.value.size).toBe(2);
    expect(state.totalCount.value).toBe(10);
    expect(state.querying.value).toBe(false);
    expect(state.mustRefresh.value).toBe(false);
  });

  it("honours blockQuery", async () => {
    const { state, pagesFn } = setup({ blockQuery: true });
    state.query();
    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();
    expect(state.querying.value).toBe(false);
  });

  it("at non-zero pagination.page sets resultsStart correctly", async () => {
    const { state } = setup();
    state.pagination.value = { page: 5, itemsPerPage: 50 };
    // Suppress the pagination watcher's auto-fire by routing through our explicit query().
    state.query();
    await flushPromises();
    expect(state.resultsStart.value).toBe(200);
    expect(state.windowCache.value.has(200)).toBe(true);
    expect(state.dataAt(0)).toBeUndefined();
  });

  it("on error wipes results and surfaces queryError", async () => {
    const failPages = vi.fn().mockRejectedValue(new Error("fail"));
    const { state } = setup({ pages: failPages });
    state.results.value = [{ id: 99 }];
    state.windowCache.value = new Map([[0, { id: 99 }]]);
    state.query();
    await flushPromises();
    expect(state.queryError.value?.message).toBe("fail");
    expect(state.results.value).toEqual([]);
    expect(state.windowCache.value.size).toBe(0);
    expect(state.totalCount.value).toBe(0);
    expect(state.querying.value).toBe(false);
  });

  it("synchronously flips querying=true so spinners appear immediately", () => {
    const { state } = setup();
    expect(state.querying.value).toBe(false);
    state.query();
    expect(state.querying.value).toBe(true); // BEFORE microtask flush
  });

  it("coalesces sync-block mutations + query() into one fetch", async () => {
    // Bootstrap first so `queryDetected` is true and the column-name watcher
    // doesn't early-return on the second mutation.
    const { state, pagesFn } = setup();
    state.query();
    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    pagesFn.mockClear();

    // Mutate columnNames + sorters + manually call query() in one sync block.
    state.columnNames.value = ["name"];
    state.sorters.value = [{ field: "name", direction: "asc" }];
    state.query();
    await flushPromises();
    // ONE fetch — the columnNames watcher, the sorters watcher, and the
    // explicit query() all coalesce into a single microtask-flushed runQuery.
    expect(pagesFn).toHaveBeenCalledTimes(1);
  });

  it("queryImmediate cancels a pending coalesced query", async () => {
    const { state, pagesFn } = setup();
    state.query(); // bootstrap
    await flushPromises();
    pagesFn.mockClear();

    state.query(); // schedules microtask
    await state.queryImmediate(); // fires now, cancels the scheduled one
    await flushPromises(); // let any straggling microtask drain
    expect(pagesFn).toHaveBeenCalledTimes(1);
  });

  it("stale response after invalidate is discarded", async () => {
    let resolveFetch!: (v: { data: unknown[]; count: number }) => void;
    const slowFetch = vi.fn(
      () =>
        new Promise<{
          data: unknown[];
          count: number;
          page: number;
          itemsPerPage: number;
          pages: number;
        }>((res) => {
          resolveFetch = (v) => res({ ...v, page: 1, itemsPerPage: 50, pages: 1 } as never);
        }),
    );
    const { state } = setup({ pages: slowFetch });

    state.query();
    await flushPromises();
    state.invalidate();
    expect(state.results.value).toEqual([]);
    resolveFetch({ data: [{ id: 1 }, { id: 2 }], count: 10 });
    await flushPromises();
    // The stale response is discarded — results stay empty.
    expect(state.results.value).toEqual([]);
    expect(state.totalCount.value).toBe(0);
  });
});
