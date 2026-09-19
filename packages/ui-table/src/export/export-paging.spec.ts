import { describe, it, expect, vi } from "vitest";
import type { Uniquery } from "@uniqu/core";
import { collectExportRows, withStableOrder, ExportAbortError } from "./export-paging";

function pageOf(start: number, size: number, total: number) {
  const data = [];
  for (let i = start; i < Math.min(start + size, total); i++) data.push({ id: i });
  return { data, count: total };
}

describe("withStableOrder", () => {
  it("appends the primary keys as a tiebreaker after the user sorters", () => {
    const q: Uniquery = { controls: { $sort: { name: 1 } } };
    const out = withStableOrder(q, ["id"]);
    expect(Object.keys(out.controls!.$sort!)).toEqual(["name", "id"]);
    expect(out.controls!.$sort!.id).toBe(1);
  });

  it("never replaces an existing sort direction on a pk field", () => {
    const q: Uniquery = { controls: { $sort: { id: -1 } } };
    expect(withStableOrder(q, ["id"])).toBe(q);
  });

  it("creates $sort when the query has none", () => {
    const out = withStableOrder({ controls: {} }, ["a", "b"]);
    expect(out.controls!.$sort).toEqual({ a: 1, b: 1 });
  });

  it("returns the input query when there are no primary keys", () => {
    const q: Uniquery = { controls: {} };
    expect(withStableOrder(q, [])).toBe(q);
  });

  it("does not mutate the input query", () => {
    const q: Uniquery = { controls: { $sort: { name: 1 } } };
    withStableOrder(q, ["id"]);
    expect(q.controls!.$sort).toEqual({ name: 1 });
  });
});

describe("collectExportRows", () => {
  it("pages until a short page and reports progress with the total", async () => {
    const fetchPage = vi.fn((_q, page: number, size: number) =>
      Promise.resolve(pageOf((page - 1) * size, size, 25)),
    );
    const onProgress = vi.fn();
    const { rows, total } = await collectExportRows({
      query: { controls: {} },
      pageSize: 10,
      fetchPage,
      onProgress,
    });
    expect(rows).toHaveLength(25);
    expect(total).toBe(25);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(onProgress.mock.calls).toEqual([
      [10, 25],
      [20, 25],
      [25, 25],
    ]);
  });

  it("stops on the reported count even when the last page is full", async () => {
    const fetchPage = vi.fn((_q, page: number, size: number) =>
      Promise.resolve(pageOf((page - 1) * size, size, 20)),
    );
    const { rows } = await collectExportRows({ query: { controls: {} }, pageSize: 10, fetchPage });
    expect(rows).toHaveLength(20);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("aborts between pages with an AbortError-shaped rejection", async () => {
    const controller = new AbortController();
    const fetchPage = vi.fn((_q, page: number, size: number) => {
      if (page === 2) controller.abort();
      return Promise.resolve(pageOf((page - 1) * size, size, 100));
    });
    await expect(
      collectExportRows({
        query: { controls: {} },
        pageSize: 10,
        fetchPage,
        signal: controller.signal,
      }),
    ).rejects.toSatisfy((e: Error) => e instanceof ExportAbortError && e.name === "AbortError");
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("aborts before the first request when the signal is already aborted", async () => {
    const fetchPage = vi.fn();
    await expect(
      collectExportRows({
        query: { controls: {} },
        fetchPage,
        signal: AbortSignal.abort(),
      }),
    ).rejects.toThrow(ExportAbortError);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("honours maxRows", async () => {
    const fetchPage = vi.fn((_q, page: number, size: number) =>
      Promise.resolve(pageOf((page - 1) * size, size, 100)),
    );
    const { rows } = await collectExportRows({
      query: { controls: {} },
      pageSize: 10,
      maxRows: 15,
      fetchPage,
    });
    expect(rows).toHaveLength(15);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("projects rows through mapRow and never projects past maxRows", async () => {
    const fetchPage = vi.fn((_q, page: number, size: number) =>
      Promise.resolve(pageOf((page - 1) * size, size, 100)),
    );
    const mapRow = vi.fn((row: Record<string, unknown>) => [row.id] as const);
    const { rows } = await collectExportRows({
      query: { controls: {} },
      pageSize: 10,
      maxRows: 12,
      fetchPage,
      mapRow,
    });
    expect(rows).toEqual(Array.from({ length: 12 }, (_, i) => [i]));
    expect(mapRow).toHaveBeenCalledTimes(12);
  });
});
