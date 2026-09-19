import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { ColumnDef } from "@atscript/ui";
import {
  collectExportRows,
  resolveExportValue,
  toCsv,
  withStableOrder,
  type CsvOptions,
  type ExportScalar,
} from "@atscript/ui-table";
import { getCellValue } from "../utils/get-cell-value";
import { useTableContext, type TableContext } from "./use-table-state";

/** Per-cell formatter override. Return `undefined` to fall back to the default. */
export type ExportCellFormatter = (
  value: unknown,
  column: ColumnDef,
  row: Record<string, unknown>,
) => ExportScalar | undefined;

export interface ExportRowsOptions {
  /**
   * `'visible'` (default) exports the visible columns in their current display
   * order, minus the client-owned ([display](/tables/customization)) ones —
   * nothing on the server backs them, so they would export as an empty column
   * unless a `formatters` entry fills them in. An array of column paths
   * exports exactly those, in that order, display columns included.
   */
  columns?: "visible" | string[];
  /** `'csv'` (default) renders a CSV string; `'rows'` returns scalar arrays. */
  format?: "csv" | "rows";
  /** Rows per request while paging. Default 500. */
  pageSize?: number;
  /** Stop the run between pages; the promise rejects with an `AbortError`. */
  signal?: AbortSignal;
  /** Called after each settled page. `total` is the first page's `count`, when the endpoint reports one. */
  onProgress?: (done: number, total?: number) => void;
  /** Global cell formatter, applied to every column that has no `formatters` entry. */
  formatCell?: ExportCellFormatter;
  /** Per-column formatters keyed by column path. Win over `formatCell`. */
  formatters?: Record<string, ExportCellFormatter>;
  /** File name for `format: 'csv'`. `.csv` is appended when missing. Default `"export.csv"`. */
  filename?: string;
  /**
   * CSV writer settings — `bom`, `escapeFormulas`, `delimiter`. Ignored by
   * `format: 'rows'`.
   */
  csv?: CsvOptions;
  /** Hard ceiling on exported rows. */
  maxRows?: number;
}

interface ExportResultBase {
  /** Header labels, in export order. */
  columns: string[];
  /** Column paths, in export order. */
  columnPaths: string[];
  /** How many data rows the run collected. */
  rowCount: number;
  /** Total the endpoint reported for the query, when it reported one. */
  total?: number;
}

/** A finished export. `format` discriminates the payload. */
export type ExportResult =
  | (ExportResultBase & { format: "csv"; csv: string; filename: string })
  | (ExportResultBase & { format: "rows"; rows: ExportScalar[][] });

/** Progress of the run in flight: rows collected so far, and the reported total. */
export interface ExportProgress {
  done: number;
  total?: number;
}

export interface UseTableExportReturn {
  /**
   * Run an export against the table's CURRENT query. Rejects when a run is
   * already in flight — one handle runs one export at a time.
   */
  exportRows: (opts?: ExportRowsOptions) => Promise<ExportResult>;
  /** `true` while an `exportRows` call is in flight. */
  exporting: ComputedRef<boolean>;
  /** Progress of the in-flight run, or `null` while idle. */
  progress: Ref<ExportProgress | null>;
}

/**
 * Export the table's data as it is queried right now.
 *
 * The export snapshots the table's own query at call time — the same filters,
 * sorters, search term, force-filters and `$select` projection the on-screen
 * fetch uses (`state.buildQuery()`), through the same fetch path
 * (`state.fetchPage()`, so a custom `queryFn` is honoured) — then pages
 * through every result instead of one page. The primary key(s) are appended
 * to the sort as a tiebreaker so pages never overlap or skip.
 *
 * Values come out of the same column metadata the cells read: union/enum keys
 * become their labels, dates become ISO strings, arrays join. Override per
 * column with `formatters`, or globally with `formatCell`.
 *
 * ```ts
 * const { exportRows } = useTableExport()
 * downloadExport(await exportRows({ filename: "orders.csv", csv: { bom: true } }))
 * ```
 *
 * Since 0.1.134.
 */
export function useTableExport(ctx?: TableContext): UseTableExportReturn {
  const state = (ctx ?? useTableContext()).state;
  const progress = ref<ExportProgress | null>(null);
  const exporting = computed(() => progress.value !== null);

  function resolveColumns(selection: ExportRowsOptions["columns"], opts: ExportRowsOptions) {
    if (selection && selection !== "visible") {
      const byPath = new Map(state.allColumns.value.map((c) => [c.path, c]));
      // An unknown path still exports — as a raw `row[path]` read under its own
      // name — so an app can pull out a field it never renders as a column.
      return selection.map((path) => byPath.get(path) ?? rawColumn(path));
    }
    // A client-owned column has no server field behind it, so the default set
    // leaves it out: it would be an always-empty column. An explicit
    // `formatters` entry means the app can fill it, so it stays.
    const local = state.localColumnPaths.value;
    const visible = state.columns.value;
    if (local.size === 0) return visible;
    return visible.filter((c) => !local.has(c.path) || opts.formatters?.[c.path]);
  }

  /**
   * One value resolver per column, built once per run: the formatter lookup
   * and the union-option index happen here instead of per cell.
   */
  function resolversFor(
    columns: ColumnDef[],
    opts: ExportRowsOptions,
  ): ((row: Record<string, unknown>) => ExportScalar)[] {
    return columns.map((column) => {
      const perColumn = opts.formatters?.[column.path];
      const formatCell = opts.formatCell;
      const labels = column.options?.length
        ? new Map(column.options.map((o) => [o.key, o.label]))
        : null;
      return (row) => {
        const raw = getCellValue(row, column.path);
        if (perColumn) {
          const out = perColumn(raw, column, row);
          if (out !== undefined) return out;
        }
        if (formatCell) {
          const out = formatCell(raw, column, row);
          if (out !== undefined) return out;
        }
        if (labels !== null && (typeof raw === "string" || typeof raw === "number")) {
          const hit = labels.get(String(raw));
          if (hit !== undefined) return hit;
        }
        // Options are already resolved above — the column would only make
        // `resolveExportValue` scan them a second time.
        return resolveExportValue(raw);
      };
    });
  }

  async function exportRows(opts: ExportRowsOptions = {}): Promise<ExportResult> {
    // One handle, one run: a second call would otherwise share `progress` and
    // let the first run's cleanup clear the second run's in-flight flag.
    if (progress.value !== null) {
      throw new Error("[vue-table] exportRows() is already running on this handle.");
    }
    const columns = resolveColumns(opts.columns, opts);
    const columnPaths = columns.map((c) => c.path);
    // `buildQuery` drops client-owned columns from `$select` itself, so a
    // display column in the export list costs nothing on the wire.
    const query = withStableOrder(
      state.buildQuery({ columnPaths, includeActions: false }),
      state.tableDef.value?.primaryKeys ?? [],
    );
    const resolvers = resolversFor(columns, opts);

    progress.value = { done: 0 };
    try {
      // Rows are formatted inside the pager, so a big export holds one
      // page of raw rows at a time instead of the whole dataset twice.
      const { rows: matrix, total } = await collectExportRows<ExportScalar[]>({
        query,
        pageSize: opts.pageSize,
        maxRows: opts.maxRows,
        signal: opts.signal,
        fetchPage: state.fetchPage,
        mapRow: (row) => resolvers.map((resolve) => resolve(row)),
        onProgress: (done, reported) => {
          progress.value = { done, total: reported };
          opts.onProgress?.(done, reported);
        },
      });

      const header = columns.map((c) => c.label || c.path);
      const base: ExportResultBase = {
        columns: header,
        columnPaths,
        rowCount: matrix.length,
        total,
      };
      if (opts.format === "rows") return { ...base, format: "rows", rows: matrix };
      return {
        ...base,
        format: "csv",
        filename: withCsvSuffix(opts.filename ?? "export.csv"),
        csv: toCsv(header, matrix, opts.csv),
      };
    } finally {
      progress.value = null;
    }
  }

  return { exportRows, exporting, progress };
}

/**
 * Hand a finished CSV export to the browser as a file download. Returns
 * `false` without doing anything when there is no DOM (SSR / a worker), so a
 * server render can call it unguarded.
 *
 * Since 0.1.134.
 */
export function downloadExport(result: ExportResult): boolean {
  if (result.format !== "csv") {
    throw new Error("[vue-table] downloadExport() needs a `format: 'csv'` export result.");
  }
  if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") return false;
  const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = result.filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
  return true;
}

function withCsvSuffix(name: string): string {
  return name.toLowerCase().endsWith(".csv") ? name : `${name}.csv`;
}

/** Minimal column for an export path that is not one of the table's columns. */
function rawColumn(path: string): ColumnDef {
  return {
    path,
    label: path,
    type: "text",
    sortable: false,
    filterable: false,
    nullable: true,
    order: 0,
  };
}
