import type { Component, ShallowRef, Ref, ComputedRef } from "vue";
import type { ColumnDef, PaginationControl, SortControl, TableDef } from "@atscript/ui";
import type {
  ColumnWidthsMap,
  ConfigTab,
  FieldFilters,
  SelectionMode,
  TableStateMethods,
} from "@atscript/ui-table";
import type { QueryErrorKind } from "./composables/use-table-state";

export type { ConfigTab };
export type { QueryErrorKind };

/** Tri-state for the multi-select header checkbox. Window mode never reaches "all". */
export type SelectAllState = "none" | "some" | "all";

/** Controls which sections appear in the column header dropdown menu. */
export interface ColumnMenuConfig {
  sort?: boolean;
  filters?: boolean;
  hide?: boolean;
  /** Show "Reset width" entry. Renders only when the column's `w !== d`. */
  resetWidth?: boolean;
}

/**
 * Component override map for table UI.
 *
 * Same pattern as vue-form's TAsTypeComponents: unstyled defaults
 * ship out of the box, user overrides any piece via this map.
 *
 * Only contains deep sub-components that are rendered inside other
 * components and cannot be composed directly by the user.
 * Layout components (toolbar, pagination, filter bar) are standalone
 * — users import and place them in their template.
 */
export interface TAsTableComponents {
  // Cells & headers
  headerCell?: Component;
  cellValue?: Component;
  columnMenu?: Component;

  // Filters
  filterInput?: Component;
  filterDialog?: Component;
  filterField?: Component;
  filterValueHelp?: Component;

  // Config
  configDialog?: Component;
  fieldsSelector?: Component;
  sortersConfig?: Component;

  // Presets
  createPreset?: Component;
  managePresets?: Component;
}

/**
 * Reactive table state — Vue implementation of the framework-agnostic
 * TableStateData + TableStateMethods interfaces.
 *
 * Arrays/objects use ShallowRef (replaced wholesale, no deep reactivity).
 * Scalars use Ref for fine-grained updates.
 */
export interface ReactiveTableState extends TableStateMethods {
  tableDef: ShallowRef<TableDef | null>;
  /** True while the table metadata (TableDef) is being loaded. */
  loadingMetadata: Ref<boolean>;
  columnNames: ShallowRef<string[]>;
  columns: ComputedRef<ColumnDef[]>;
  allColumns: ShallowRef<ColumnDef[]>;
  /**
   * Per-column widths keyed by column path; always populated for every column.
   * Each entry: `{ w: currentRenderedWidth, d: defaultWidth }`. Deep-reactive —
   * writers mutate `entry.w` directly. Default is the @ui.field.width annotation
   * when present, otherwise type+@expect.maxLen-derived (see `computeDefaultColumnWidth`).
   */
  columnWidths: Ref<ColumnWidthsMap>;
  filterFields: ShallowRef<string[]>;
  filters: ShallowRef<FieldFilters>;
  sorters: ShallowRef<SortControl[]>;
  results: ShallowRef<Record<string, unknown>[]>;
  /** Absolute index where `results[0]` sits. */
  resultsStart: Ref<number>;
  /** Universal cache of every loaded row keyed by absolute index. */
  windowCache: ShallowRef<Map<number, Record<string, unknown>>>;
  /** Block firstIndex values currently being fetched by `loadRange`. */
  windowLoading: ShallowRef<Set<number>>;
  /** Absolute index at the top of a windowed renderer's viewport. */
  topIndex: Ref<number>;
  /** Number of fixed-pool rows a windowed renderer is displaying. */
  viewportRowCount: Ref<number>;
  querying: Ref<boolean>;
  queryingNext: Ref<boolean>;
  totalCount: Ref<number>;
  loadedCount: ComputedRef<number>;
  pagination: Ref<PaginationControl>;
  queryError: Ref<Error | null>;
  metadataError: Ref<Error | null>;
  /**
   * Most recent fetch error of any kind, tagged with `kind` so consumers
   * can format toasts differently per source. Wrapped in a fresh
   * `{ error, kind }` object on every assignment so watchers fire even
   * when consecutive failures share an Error reference. Fire-and-forget:
   * a successful retry does NOT clear this; it just stops re-firing.
   */
  lastError: Ref<{ error: Error; kind: QueryErrorKind } | null>;
  mustRefresh: Ref<boolean>;
  searchTerm: Ref<string>;
  configDialogOpen: Ref<boolean>;
  configTab: Ref<ConfigTab>;
  /** Selected row values (same values as ListboxItem :value). */
  selectedRows: ShallowRef<unknown[]>;
  selectedCount: ComputedRef<number>;
  /** Selection mode. */
  selectionMode: SelectionMode;
  /** Extract unique value from a row for selection tracking + ListboxItem :value. */
  rowValueFn: (row: Record<string, unknown>) => unknown;
  /** Column currently open in the filter dialog (null when closed). */
  filterDialogColumn: Ref<ColumnDef | null>;
}
