import { describe, it, expect, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountTableState, rows } from "./helpers";

function setup(opts?: { pages?: ReturnType<typeof vi.fn>; blockQuery?: boolean }) {
  const { state, pagesFn } = mountTableState({
    data: [],
    count: 0,
    pages: opts?.pages,
    blockQuery: opts?.blockQuery,
  });
  return { state, pages: pagesFn };
}

describe("state.queryNext re-entry", () => {
  it("rapid calls — second is suppressed while first in flight", async () => {
    let resolves: ((v: {
      data: unknown[];
      count: number;
      page: number;
      itemsPerPage: number;
      pages: number;
    }) => void)[] = [];
    const pages = vi.fn(
      () =>
        new Promise<{
          data: unknown[];
          count: number;
          page: number;
          itemsPerPage: number;
          pages: number;
        }>((res) => {
          resolves.push(res);
        }),
    );
    const { state } = setup({ pages });
    state.queryNext();
    expect(state.queryingNext.value).toBe(true);
    expect(pages).toHaveBeenCalledTimes(1);

    state.queryNext(); // re-entry; should be suppressed.
    expect(pages).toHaveBeenCalledTimes(1);

    resolves[0]({ data: rows(0, 100), count: 1000, page: 1, itemsPerPage: 100, pages: 10 });
    await flushPromises();
    expect(state.queryingNext.value).toBe(false);
  });

  it("queryingNext resets after generation-discard (invalidate while in flight)", async () => {
    let resolves: ((v: {
      data: unknown[];
      count: number;
      page: number;
      itemsPerPage: number;
      pages: number;
    }) => void)[] = [];
    const pages = vi.fn(
      () =>
        new Promise<{
          data: unknown[];
          count: number;
          page: number;
          itemsPerPage: number;
          pages: number;
        }>((res) => {
          resolves.push(res);
        }),
    );
    const { state } = setup({ pages });
    state.queryNext();
    expect(state.queryingNext.value).toBe(true);
    state.invalidate();
    resolves[0]({ data: rows(0, 100), count: 1000, page: 1, itemsPerPage: 100, pages: 10 });
    await flushPromises();
    expect(state.queryingNext.value).toBe(false);
  });

  it("queryingNext resets when next block is fully cached (zero dispatches)", async () => {
    const pages = vi.fn();
    const { state } = setup({ pages });
    // Prime cache directly so queryNext's loadRange request is fully covered
    // without any dispatch. Results island has 50 rows [0..49]; next block
    // (page 1, indices [0..99]) — already covered by manually filling the
    // cache for ALL of [0..99].
    state.results.value = rows(0, 50);
    state.resultsStart.value = 0;
    const cache = new Map<number, Record<string, unknown>>();
    for (let i = 0; i < 100; i++) cache.set(i, { id: i });
    state.windowCache.value = cache;
    // queryNext: skip = resultsStart + results.length = 50, limit = blockSize = 100.
    // pageAlignedBlocksFor(50, 100, 100) → 2 blocks (page 1 [0..99], page 2 [100..199]).
    // Page 1 fully cached → not dispatched. Page 2 NOT cached → would dispatch.
    // Re-prime so page 2 is cached too:
    for (let i = 100; i < 200; i++) cache.set(i, { id: i });
    state.windowCache.value = new Map(cache);
    pages.mockClear();
    state.queryNext();
    await flushPromises();
    expect(state.queryingNext.value).toBe(false);
    expect(pages).toHaveBeenCalledTimes(0);
  });

  it("blockQuery short-circuit: queryingNext does not flip true", async () => {
    const { state } = setup({ blockQuery: true });
    state.queryNext();
    expect(state.queryingNext.value).toBe(false);
  });
});
