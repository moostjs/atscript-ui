import type { ColumnDef, PaginationControl, SortControl, TableDef } from "@atscript/ui";
import type { FilterCondition, FieldFilters } from "../filters/filter-types";

/**
 * Framework-agnostic table state data.
 *
 * Defines the contract that any framework wrapper (Vue/React) must implement.
 * Values are plain — the framework wraps them in its own reactive primitives.
 */
export interface TableStateData {
  /** Resolved table definition (null until metadata loads). */
  tableDef: TableDef | null;
  /** Names of visible columns, in display order. */
  columnNames: string[];
  /** Current visible columns (derived from columnNames + allColumns). */
  columns: ColumnDef[];
  /** All columns from tableDef (including hidden). */
  allColumns: ColumnDef[];
  /** Names of filter fields displayed in the filter bar. */
  filterFields: string[];
  /** Active field filters. */
  filters: FieldFilters;
  /** Active sorters. */
  sorters: SortControl[];
  /** Current result rows. */
  results: Record<string, unknown>[];
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

/** Methods that any table state implementation must provide. */
export interface TableStateMethods {
  /** Trigger a fresh query (replace results). */
  query(): void;
  /** Load the next page (append results). */
  queryNext(): void;
  /** Reset all filters to empty. */
  resetFilters(): void;
  /** Open the config dialog (optionally to a specific tab). */
  showConfigDialog(tab?: "columns" | "filters" | "sorters"): void;
  /** Set visible column names in display order. */
  setColumnNames(names: string[]): void;
  /** Replace visible columns (extracts paths — backward compat). */
  setColumns(columns: ColumnDef[]): void;
  /** Replace active sorters. */
  setSorters(sorters: SortControl[]): void;
  /** Add a field to the displayed filter fields. */
  addFilterField(path: string): void;
  /** Remove a field from displayed filter fields and clear its conditions. */
  removeFilterField(path: string): void;
  /** Set filter conditions for a specific field (replaces existing). */
  setFieldFilter(path: string, conditions: FilterCondition[]): void;
  /** Remove all filter conditions for a specific field (keeps filterFields). */
  removeFieldFilter(path: string): void;
  /** Open filter dialog for a column. */
  openFilterDialog(column: ColumnDef): void;
  /** Close filter dialog. */
  closeFilterDialog(): void;
}
