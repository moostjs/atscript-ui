import type { ColumnDef, PaginationControl, SortControl, TableDef } from "@atscript/ui";
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
  /** Trigger a fresh query (replace results). User-initiated refresh only. */
  query(): void;
  /** Load the next page (append results). */
  queryNext(): void;
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
   * Clear the applied filter for a field. Does NOT remove the field from
   * `filterFields` — the input row stays visible.
   */
  removeFieldFilter(path: string): void;
  /** Open filter dialog for a column. */
  openFilterDialog(column: ColumnDef): void;
  /** Close filter dialog. */
  closeFilterDialog(): void;
}
