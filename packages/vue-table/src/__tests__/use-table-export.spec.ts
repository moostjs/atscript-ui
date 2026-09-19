import { describe, expect, it, vi } from "vitest";
import type { Uniquery } from "@uniqu/core";
import type { Client } from "@atscript/db-client";
import { useTableExport, downloadExport } from "../composables/use-table-export";
import type { ReactiveTableState } from "../types";
import { mockColumn, mountTableState, stubClient } from "./helpers";

interface Recorded {
  query: Uniquery;
  page: number;
  size: number;
}

/**
 * Build a table state whose fetcher serves `total` synthetic rows and records
 * every query it is handed.
 */
function setup(
  opts: {
    total?: number;
    columns?: ReturnType<typeof mockColumn>[];
    displayColumns?: import("@atscript/ui-table").DisplayColumnDef[];
  } = {},
) {
  const total = opts.total ?? 3;
  const seen: Recorded[] = [];
  const queryFn = vi.fn((query: Uniquery, page: number, size: number) => {
    seen.push({ query, page, size });
    const start = (page - 1) * size;
    const data = [];
    for (let i = start; i < Math.min(start + size, total); i++) {
      data.push({ id: i, name: `n${i}`, secret: `s${i}` });
    }
    return Promise.resolve({ data, count: total, page, itemsPerPage: size, pages: 1 });
  });
  const { state } = mountTableState({
    columns: opts.columns ?? [mockColumn("id"), mockColumn("name"), mockColumn("secret")],
    displayColumns: opts.displayColumns,
    queryFn,
  });
  return { state, seen, queryFn };
}

function ctxOf(state: ReactiveTableState) {
  return { state, client: stubClient() as Client, controls: {} };
}

describe("useTableExport", () => {
  it("exports the visible columns in their display order and excludes hidden ones", async () => {
    const { state, seen } = setup();
    state.columnNames.value = ["name", "id"];
    const { exportRows } = useTableExport(ctxOf(state));

    const result = await exportRows({ format: "rows" });

    expect(result.columns).toEqual(["name", "id"]);
    expect(result.format === "rows" && result.rows[0]).toEqual(["n0", 0]);
    expect(seen[0]!.query.controls!.$select).toEqual(["name", "id"]);
    expect(seen[0]!.query.controls!.$select).not.toContain("secret");
  });

  it("exports an explicit column list in the given order", async () => {
    const { state } = setup();
    const { exportRows } = useTableExport(ctxOf(state));
    const result = await exportRows({ format: "rows", columns: ["secret", "id"] });
    expect(result.columnPaths).toEqual(["secret", "id"]);
    expect(result.format === "rows" && result.rows[0]).toEqual(["s0", 0]);
  });

  it("keeps the active filters, search and sorters, and appends the pk as a tiebreaker", async () => {
    const { state, seen } = setup();
    state.sorters.value = [{ field: "name", direction: "desc" }];
    state.searchTerm.value = "abc";
    const { exportRows } = useTableExport(ctxOf(state));

    await exportRows({ format: "rows" });

    const controls = seen[0]!.query.controls!;
    expect(Object.keys(controls.$sort!)).toEqual(["name", "id"]);
    expect(controls.$sort).toEqual({ name: -1, id: 1 });
    expect(controls.$search).toBe("abc");
  });

  it("pages through every result and reports progress", async () => {
    const { state, seen } = setup({ total: 25 });
    const onProgress = vi.fn();
    const { exportRows, exporting } = useTableExport(ctxOf(state));

    const result = await exportRows({ format: "rows", pageSize: 10, onProgress });

    expect(result.rowCount).toBe(25);
    expect(seen.map((s) => s.page)).toEqual([1, 2, 3]);
    expect(seen.every((s) => s.size === 10)).toBe(true);
    expect(onProgress.mock.calls).toEqual([
      [10, 25],
      [20, 25],
      [25, 25],
    ]);
    expect(exporting.value).toBe(false);
  });

  it("aborts between pages and clears the in-flight flag", async () => {
    const { state, seen } = setup({ total: 100 });
    const controller = new AbortController();
    const { exportRows, exporting } = useTableExport(ctxOf(state));
    const promise = exportRows({
      format: "rows",
      pageSize: 10,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(seen).toHaveLength(1);
    expect(exporting.value).toBe(false);
  });

  it("writes RFC 4180 CSV with a normalised filename", async () => {
    const { state } = setup({ total: 2 });
    state.columnNames.value = ["id", "name"];
    const { exportRows } = useTableExport(ctxOf(state));

    const result = await exportRows({ filename: "orders" });

    expect(result.format).toBe("csv");
    expect(result.format === "csv" && result.filename).toBe("orders.csv");
    expect(result.format === "csv" && result.csv).toBe("id,name\r\n0,n0\r\n1,n1\r\n");
  });

  it("lets per-column formatters win over the global one", async () => {
    const { state } = setup({ total: 1 });
    state.columnNames.value = ["id", "name"];
    const { exportRows } = useTableExport(ctxOf(state));

    const result = await exportRows({
      format: "rows",
      formatCell: (value) => `g:${String(value)}`,
      formatters: { name: (value) => `c:${String(value)}` },
    });

    expect(result.format === "rows" && result.rows[0]).toEqual(["g:0", "c:n0"]);
  });

  it("escapes formula-looking cells unless told not to", async () => {
    const { state } = setup({ total: 1 });
    state.columnNames.value = ["name"];
    const { exportRows } = useTableExport(ctxOf(state));

    const escaped = await exportRows({ formatters: { name: () => "=SUM(A1)" } });
    expect(escaped.format === "csv" && escaped.csv).toContain("'=SUM(A1)");

    const raw = await exportRows({
      csv: { escapeFormulas: false },
      formatters: { name: () => "=SUM(A1)" },
    });
    expect(raw.format === "csv" && raw.csv.includes("'=SUM(A1)")).toBe(false);
  });

  it("passes the csv block through to the writer", async () => {
    const { state } = setup({ total: 1 });
    state.columnNames.value = ["id", "name"];
    const { exportRows } = useTableExport(ctxOf(state));

    const result = await exportRows({ csv: { delimiter: ";", bom: true } });
    expect(result.format === "csv" && result.csv).toBe("\uFEFFid;name\r\n0;n0\r\n");
  });

  it("leaves client-owned columns out of the default set unless a formatter fills them", async () => {
    const displayColumns = [{ key: "score", label: "Score" }];
    const { state } = setup({ total: 1, displayColumns });
    const { exportRows } = useTableExport(ctxOf(state));

    const bare = await exportRows({ format: "rows" });
    expect(bare.columnPaths).not.toContain("score");

    const filled = await exportRows({
      format: "rows",
      formatters: { score: () => "computed" },
    });
    expect(filled.columnPaths).toContain("score");
    expect(filled.format === "rows" && filled.rows[0]).toContain("computed");

    // An explicit list still exports it.
    const explicit = await exportRows({ format: "rows", columns: ["score"] });
    expect(explicit.columnPaths).toEqual(["score"]);
  });

  it("refuses a second run while one is in flight", async () => {
    const { state } = setup({ total: 2 });
    const { exportRows, exporting, progress } = useTableExport(ctxOf(state));

    const first = exportRows({ format: "rows" });
    expect(exporting.value).toBe(true);
    await expect(exportRows({ format: "rows" })).rejects.toThrow(/already running/);
    await first;
    // The rejected call must not have cleared the first run's state early,
    // and the settled run leaves the handle idle.
    expect(exporting.value).toBe(false);
    expect(progress.value).toBeNull();
  });

  it("never asks the server for $actions", async () => {
    const { state, seen } = setup({ total: 1 });
    state.includeActions.value = true;
    const { exportRows } = useTableExport(ctxOf(state));
    await exportRows({ format: "rows" });
    expect(seen[0]!.query.controls!.$actions).toBeUndefined();
  });
});

describe("downloadExport", () => {
  it("refuses a non-CSV result", () => {
    expect(() =>
      downloadExport({
        format: "rows",
        columns: [],
        columnPaths: [],
        rowCount: 0,
        rows: [],
      }),
    ).toThrow(/format: 'csv'/);
  });
});
