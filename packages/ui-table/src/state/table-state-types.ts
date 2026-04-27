import type { ColumnDef, PaginationControl, SortControl, TableDef } from "@atscript/ui";
import type { ColumnWidthsMap } from "../columns/column-widths";
import type { FilterCondition, FieldFilters } from "../filters/filter-types";

export type ConfigTab = "columns" | "filters" | "sorters";

/**
 * Framework-agnostic table state data.
 *
 * Defines the contract that any framework wrapper (Vue/React) must implement.
 * Values are plain — the framework wraps them in its own reactive primitives.
 */
export interface TableStateData {
  /** Resolved table definition (null until metadata loads). */
  tableDef: TableDef | null;
  /** True while the table metadata (TableDef) is being loaded. */
  loadingMetadata: boolean;
  /** Names of visible columns, in display order. */
  columnNames: string[];
  /** Current visible columns (derived from columnNames + allColumns). */
  columns: ColumnDef[];
  /** All columns from tableDef (including hidden). */
  allColumns: ColumnDef[];
  /**
   * Per-column widths keyed by column path. Always fully populated for every
   * column in `allColumns` once the TableDef has loaded. Each entry carries
   * the current rendered width (`w`) and the default (`d`) it would reset to.
   * Default sourcing: `@ui.field.width` annotation > type+@expect.maxLen-derived.
   */
  columnWidths: ColumnWidthsMap;
  /** Names of filter fields displayed in the filter bar. */
  filterFields: string[];
  /** Active field filters. */
  filters: FieldFilters;
  /** Active sorters. */
  sorters: SortControl[];
  /**
   * Rows of the contiguous "results island" anchored at `resultsStart`. This
   * is a real array (not a computed view) — same row references also live in
   * `windowCache` at their absolute indices. Writes flow through both, so
   * extending `results` automatically updates the cache.
   */
  results: Record<string, unknown>[];
  /**
   * Absolute row index where `results[0]` sits. Reset by `query()` and
   * `invalidate()` from `pagination.page`; shifted by backward merges in
   * `loadRange`'s digest.
   */
  resultsStart: number;
  /**
   * Universal storage for every loaded row keyed by absolute index. Includes
   * the rows in `results` (same row references, two indexings).
   */
  windowCache: Map<number, Record<string, unknown>>;
  /**
   * Block firstIndex values currently being fetched by `loadRange`. A row at
   * `absIdx` is in flight when its block (`floor(absIdx / blockSize) * blockSize`)
   * is in this set. Drives the per-row skeleton placeholder in window-mode
   * rendering. NOT set by `query()` (uses `querying`) or `queryNext()` (uses
   * `queryingNext`).
   */
  windowLoading: Set<number>;
  /** Absolute row index at the top of a windowed renderer's visible viewport. */
  topIndex: number;
  /** Number of fixed-pool rows a windowed renderer is currently displaying. */
  viewportRowCount: number;
  /** Whether a query is currently in flight. */
  querying: boolean;
  /** Whether a "load more" query is in flight. */
  queryingNext: boolean;
  /** Total row count from the server. */
  totalCount: number;
  /** Number of rows currently loaded. */
  loadedCount: number;
  /** Pagination state. */
  pagination: PaginationControl;
  /** Last query error (null when successful). */
  queryError: Error | null;
  /** Metadata loading error (null when successful). */
  metadataError: Error | null;
  /** True when state changed during an in-flight query (results are stale). */
  mustRefresh: boolean;
  /** Full-text search term. */
  searchTerm: string;
}

/**
 * Methods that any table state implementation must provide.
 *
 * The table is model-driven: these mutators are thin wrappers that each touch
 * exactly one entity (`filterFields` OR `filters`, never both). Side effects
 * like pagination reset or re-query happen in watchers on the root state arrays,
 * not inside the mutators — so any writer (dialog, external v-model, custom
 * toolbar) gets identical behaviour.
 */
export interface TableStateMethods {
  /**
   * Microtask-coalesced refresh. Synchronously sets `querying = true` so
   * consumers see the loading state immediately, then schedules the actual
   * fetch on the next microtask. Multiple `query()` calls and watcher-driven
   * scheduleQuery calls in the same synchronous block coalesce into one
   * fetch. Use this from dialogs / mutators where you don't need to await.
   */
  query(): void;
  /**
   * Synchronous refresh — fires the fetch now and returns a Promise that
   * settles when the response (or error) has been processed. Cancels any
   * pending coalesced query so we don't double-fire. Honours `blockQuery`,
   * `forceFilters`, `forceSorters`, `queryFn`. Use this from refresh
   * buttons / programmatic flows that need the result.
   */
  queryImmediate(): Promise<void>;
  /**
   * Append-style extension. Does NOT mutate `pagination.page` (extension
   * runs parallel to pagination). Re-entry guarded via `queryingNext`.
   */
  queryNext(): void;
  /**
   * Page-aligned slice fetch into `windowCache` with merge-on-contiguous.
   * Returns a Promise that settles when ALL dispatched blocks have settled
   * (success, error, OR generation-discarded); never rejects. Resolves on
   * the next microtask when zero blocks need dispatching.
   */
  loadRange(skip: number, limit: number): Promise<void>;
  /**
   * Explicit immediate wipe — clears results / cache / loading, resets
   * `resultsStart` from `pagination.page`, sets `totalCount = 0`. Does NOT
   * auto-refetch.
   */
  invalidate(): void;
  /** O(1) read of `windowCache.get(absIdx)`. */
  dataAt(absIdx: number): Record<string, unknown> | undefined;
  /** True if the block covering `absIdx` is currently being fetched. */
  loadingAt(absIdx: number): boolean;
  /** Returns the last error attached to the block covering `absIdx`, or null. */
  errorAt(absIdx: number): Error | null;
  /** Clear all applied filters. Does not touch `filterFields`. */
  resetFilters(): void;
  /** Open the config dialog (optionally to a specific tab). */
  showConfigDialog(tab?: ConfigTab): void;
  /** Append a field to the displayed filter fields (deduped). */
  addFilterField(path: string): void;
  /**
   * Remove a field from the displayed filter fields. Does NOT clear the
   * applied filter value — display state and applied state are independent.
   * Use `removeFieldFilter` to clear the value.
   */
  removeFilterField(path: string): void;
  /** Set applied filter conditions for a field. Does not touch `filterFields`. */
  setFieldFilter(path: string, conditions: FilterCondition[]): void;
  /**
   * Set the rendered width for a column. No-op if the column is unknown or
   * the value is unchanged. Does not modify the column's default (`d`).
   */
  setColumnWidth(path: string, width: string): void;
  /**
   * Reset the rendered width back to the column's default (`d`). No-op if
   * the column is unknown or already at default.
   */
  resetColumnWidth(path: string): void;
  /**
   * Clear the applied filter for a field. Does NOT remove the field from
   * `filterFields` — the input row stays visible.
   */
  removeFieldFilter(path: string): void;
  /** Open filter dialog for a column. */
  openFilterDialog(column: ColumnDef): void;
  /** Close filter dialog. */
  closeFilterDialog(): void;
}
