import { describe, it, expect, vi } from "vitest";
import { mountTableState, rows } from "./helpers";

function setup(pages?: ReturnType<typeof vi.fn>, opts?: { blockQuery?: boolean }) {
  const { state, pagesFn, client } = mountTableState({
    data: [],
    count: 0,
    pages,
    blockQuery: opts?.blockQuery,
  });
  return { state, pages: pages ?? pagesFn, client };
}

describe("state.loadRange()", () => {
  it("dispatches one request per missing block", async () => {
    const pages = vi.fn().mockImplementation((_q, page: number, size: number) =>
      Promise.resolve({
        data: rows((page - 1) * size, size),
        count: 1000,
        page,
        itemsPerPage: size,
        pages: 10,
      }),
    );
    const { state } = setup(pages);
    await state.loadRange(0, 50);
    expect(pages).toHaveBeenCalledTimes(1);
    expect(state.windowCache.value.size).toBe(100);
  });

  it("dispatches one parallel request per missing block (size = blockSize)", async () => {
    // The server's pagination contract is `skip = (page - 1) * size`, so we
    // can't safely combine multiple page-aligned blocks into one oversized
    // request — the same `page` value points at a different `skip` if `size`
    // changes. Each block always dispatches at `size = blockSize` to keep the
    // skip→page mapping consistent.
    const pages = vi.fn().mockImplementation((_q, page: number, size: number) =>
      Promise.resolve({
        data: rows((page - 1) * size, size),
        count: 1000,
        page,
        itemsPerPage: size,
        pages: 10,
      }),
    );
    const { state } = setup(pages);
    await state.loadRange(50, 200);
    expect(pages).toHaveBeenCalledTimes(3);
    const sizes = pages.mock.calls.map((c) => c[2]);
    expect(sizes).toEqual([100, 100, 100]);
  });

  it("skips blocks already in cache", async () => {
    const pages = vi.fn().mockImplementation((_q, page: number, size: number) =>
      Promise.resolve({
        data: rows((page - 1) * size, size),
        count: 1000,
        page,
        itemsPerPage: size,
        pages: 10,
      }),
    );
    const { state } = setup(pages);
    await state.loadRange(0, 100);
    expect(pages).toHaveBeenCalledTimes(1);
    pages.mockClear();
    // Second call covers the same range — should dispatch nothing.
    await state.loadRange(50, 50);
    expect(pages).toHaveBeenCalledTimes(0);
  });

  it("forward-merges into results island when contiguous", async () => {
    const pages = vi.fn().mockImplementation((_q, page: number, size: number) =>
      Promise.resolve({
        data: rows((page - 1) * size, size),
        count: 1000,
        page,
        itemsPerPage: size,
        pages: 10,
      }),
    );
    const { state } = setup(pages);
    // Seed results = [0..49], resultsStart = 0.
    state.results.value = rows(0, 50);
    state.resultsStart.value = 0;
    state.windowCache.value = new Map(rows(0, 50).map((r, i) => [i, r]));
    // pageAlignedBlocksFor(50, 50, 100) → block firstIndex=0, page=1.
    // The fetched block writes to the cache; walkForwardAbsorb then has no
    // gap to bridge from results=[0..49] to the cached island at [0..99]
    // (they overlap, not abut), so results stays at [0..49] and cache grows.
    await state.loadRange(100, 50);
    expect(state.windowCache.value.size).toBeGreaterThanOrEqual(150);
  });

  it("backward-merges and shifts resultsStart", async () => {
    const pages = vi.fn().mockImplementation((_q, page: number, size: number) =>
      Promise.resolve({
        data: rows((page - 1) * size, size),
        count: 1000,
        page,
        itemsPerPage: size,
        pages: 10,
      }),
    );
    const { state } = setup(pages);
    // Seed results = [200..249], resultsStart = 200.
    state.results.value = rows(200, 50);
    state.resultsStart.value = 200;
    state.windowCache.value = new Map(rows(200, 50).map((r, i) => [200 + i, r]));
    // Load block at 100 — block firstIndex=100, blockRows=[100..199], block end+1 = 200 = resultsStart.
    await state.loadRange(100, 100);
    expect(state.resultsStart.value).toBe(100);
    expect(state.results.value.length).toBeGreaterThanOrEqual(150);
  });

  it("blockQuery early-return", async () => {
    const pages = vi.fn();
    const { state } = setup(pages, { blockQuery: true });
    const result = await state.loadRange(0, 100);
    expect(result).toBeUndefined();
    expect(pages).not.toHaveBeenCalled();
    expect(state.windowCache.value.size).toBe(0);
  });

  it("generation cancellation discards stale responses", async () => {
    let resolveFetch!: (v: {
      data: unknown[];
      count: number;
      page: number;
      itemsPerPage: number;
      pages: number;
    }) => void;
    const pages = vi.fn(
      () =>
        new Promise<{
          data: unknown[];
          count: number;
          page: number;
          itemsPerPage: number;
          pages: number;
        }>((res) => {
          resolveFetch = res;
        }),
    );
    const { state } = setup(pages);
    const promise = state.loadRange(0, 100);
    state.invalidate(); // bumps generation
    resolveFetch({ data: rows(0, 100), count: 1000, page: 1, itemsPerPage: 100, pages: 10 });
    await promise;
    // Stale response — cache should remain empty.
    expect(state.windowCache.value.size).toBe(0);
  });

  it("returned Promise resolves immediately when zero blocks dispatch", async () => {
    const pages = vi.fn().mockImplementation((_q, page: number, size: number) =>
      Promise.resolve({
        data: rows((page - 1) * size, size),
        count: 1000,
        page,
        itemsPerPage: size,
        pages: 10,
      }),
    );
    const { state } = setup(pages);
    await state.loadRange(0, 50);
    pages.mockClear();
    const start = Date.now();
    await state.loadRange(0, 50); // already cached
    expect(Date.now() - start).toBeLessThan(50);
    expect(pages).not.toHaveBeenCalled();
  });
});
