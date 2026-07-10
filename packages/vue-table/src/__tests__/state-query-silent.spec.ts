import { describe, it, expect, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { deferredPages, mockColumn, mountTableState } from "./helpers";

function setup(overrides?: {
  data?: Record<string, unknown>[];
  count?: number;
  pages?: ReturnType<typeof vi.fn>;
}) {
  return mountTableState({
    columns: [mockColumn("name"), mockColumn("age")],
    data: overrides?.data,
    count: overrides?.count,
    pages: overrides?.pages,
  });
}

describe("state.query({ silent: true })", () => {
  it("never flips querying — synchronously, mid-flight, and after settle", async () => {
    const { fetchFn, resolve } = deferredPages();
    const { state } = setup({ pages: fetchFn });

    state.query({ silent: true });
    expect(state.querying.value).toBe(false); // synchronously

    await flushPromises();
    expect(state.querying.value).toBe(false); // mid-flight
    expect(fetchFn).toHaveBeenCalledTimes(1);

    resolve({ data: [{ id: 1 }, { id: 2 }], count: 10 });
    await flushPromises();
    expect(state.querying.value).toBe(false); // after settle
    expect(state.results.value).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("still swaps results / windowCache / totalCount on success (keep-rows-until-settle)", async () => {
    const { fetchFn, resolve } = deferredPages();
    const { state } = setup({ pages: fetchFn });
    state.results.value = [{ id: 99 }];
    state.windowCache.value = new Map([[0, { id: 99 }]]);

    state.query({ silent: true });
    await flushPromises();
    // Mid-flight: prior data still visible — no pre-wipe.
    expect(state.results.value).toEqual([{ id: 99 }]);
    expect(state.windowCache.value.size).toBe(1);

    resolve({ data: [{ id: 1 }, { id: 2 }], count: 10 });
    await flushPromises();
    expect(state.results.value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(state.windowCache.value.size).toBe(2);
    expect(state.totalCount.value).toBe(10);
  });

  it("leaves rows / cache / totalCount / errors untouched on failure", async () => {
    const failPages = vi.fn().mockRejectedValue(new Error("fail"));
    const { state } = setup({ pages: failPages });
    state.results.value = [{ id: 99 }];
    state.windowCache.value = new Map([[0, { id: 99 }]]);
    state.totalCount.value = 7;

    state.query({ silent: true });
    await flushPromises();

    expect(state.results.value).toEqual([{ id: 99 }]);
    expect(state.windowCache.value.size).toBe(1);
    expect(state.totalCount.value).toBe(7);
    expect(state.queryError.value).toBeNull();
    expect(state.lastError.value).toBeNull();
    expect(state.querying.value).toBe(false);
  });

  it("loud wins when coalesced with a loud query in the same tick", async () => {
    const { state, pagesFn } = setup();

    state.query({ silent: true });
    state.query();
    expect(state.querying.value).toBe(true); // loud won, synchronously

    await flushPromises();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(state.querying.value).toBe(false);
  });

  it("queryImmediate({ silent: true }) is awaitable and never flips querying", async () => {
    const { state, pagesFn } = setup();

    const p = state.queryImmediate({ silent: true });
    expect(state.querying.value).toBe(false);
    await p;
    expect(state.querying.value).toBe(false);
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(state.results.value).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("preserves topIndex (a loud query() would snap it to 0)", async () => {
    const { state } = setup();
    state.topIndex.value = 40;

    state.query({ silent: true });
    await flushPromises();

    expect(state.topIndex.value).toBe(40);
  });
});
