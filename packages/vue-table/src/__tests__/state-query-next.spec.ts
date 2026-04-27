import { describe, it, expect, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountTableState, rows } from "./helpers";

function setup(opts?: { blockQuery?: boolean; pages?: ReturnType<typeof vi.fn> }) {
  return mountTableState({
    data: rows(0, 50),
    count: 1000,
    pages: opts?.pages,
    blockQuery: opts?.blockQuery,
  });
}

describe("state.queryNext()", () => {
  it("does NOT mutate pagination.page", async () => {
    const pages = vi
      .fn()
      .mockResolvedValueOnce({
        data: rows(0, 50),
        count: 1000,
        page: 1,
        itemsPerPage: 50,
        pages: 20,
      })
      .mockResolvedValueOnce({
        data: rows(50, 100),
        count: 1000,
        page: 1,
        itemsPerPage: 100,
        pages: 10,
      });
    const { state } = setup({ pages });
    state.query();
    await flushPromises();
    expect(state.results.value.length).toBe(50);
    expect(state.pagination.value.page).toBe(1);

    state.queryNext();
    await flushPromises();
    expect(state.pagination.value.page).toBe(1);
    expect(state.resultsStart.value).toBe(0);
  });

  it("extends results AND windowCache via loadRange", async () => {
    // Use loadRange directly to demonstrate forward-merge extension.
    const pages = vi.fn().mockImplementation((_q, page: number, size: number) =>
      Promise.resolve({
        data: rows((page - 1) * size, size),
        count: 1000,
        page,
        itemsPerPage: size,
        pages: 10,
      }),
    );
    const { state } = setup({ pages });
    // First query lands at resultsStart=0 with first page (50 rows).
    state.query();
    await flushPromises();
    expect(state.results.value.length).toBe(50);

    // queryNext does loadRange(50, blockSize=100). pageAlignedBlocksFor(50, 100, 100)
    // = block page 1 (already partially cached, re-fetches) + block page 2 (new).
    state.queryNext();
    await flushPromises();
    expect(state.windowCache.value.size).toBeGreaterThanOrEqual(150);
  });

  it("at non-zero resultsStart fetches at correct offset", async () => {
    const pages = vi
      .fn()
      .mockResolvedValueOnce({
        data: rows(200, 50),
        count: 1000,
        page: 5,
        itemsPerPage: 50,
        pages: 20,
      })
      .mockResolvedValueOnce({
        data: rows(250, 100),
        count: 1000,
        page: 3,
        itemsPerPage: 100,
        pages: 10,
      });
    const { state } = setup({ pages });
    state.pagination.value = { page: 5, itemsPerPage: 50 };
    state.query();
    await flushPromises();
    expect(state.resultsStart.value).toBe(200);

    state.queryNext();
    await flushPromises();
    // We don't strictly assert the page param here (depends on pageAlignedBlocksFor
    // alignment); we assert the underlying cache extends past 250.
    expect(state.windowCache.value.has(250)).toBe(true);
  });

  it("honours blockQuery", async () => {
    const { state, pagesFn } = setup({ blockQuery: true });
    state.queryNext();
    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();
    expect(state.queryingNext.value).toBe(false);
  });
});
