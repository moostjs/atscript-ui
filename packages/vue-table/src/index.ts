// ── Types ───────────────────────────────────────────────────
export type { TAsTableComponents, ReactiveTableState, ColumnMenuConfig } from "./types";

// ── Composables ─────────────────────────────────────────────
export {
  useTable,
  clearTableCache,
  setDefaultClientFactory,
  getDefaultClientFactory,
  type UseTableOptions,
  type TableClientFactory,
} from "./composables/use-table";
export {
  useTableContext,
  createTableState,
  type TableContext,
  type CreateTableStateOptions,
  type TableStateInternals,
} from "./composables/use-table-state";
export { useTableQuery, type UseTableQueryOptions } from "./composables/use-table-query";
export { useTableSelection } from "./composables/use-table-selection";
export { useTableFilter } from "./composables/use-table-filter";
export { useTableSearch } from "./composables/use-table-search";

// ── Component resolution ────────────────────────────────────
export { useTableComponent } from "./composables/use-table-component";

// ── Components ──────────────────────────────────────────────
export { default as AsTableRoot } from "./components/as-table-root.vue";
export { default as AsTableView } from "./components/as-table-view.vue";
export { default as AsTableBase } from "./components/as-table-base.vue";
export { default as AsTableHeaderCell } from "./components/as-table-header-cell.vue";
export { default as AsTableCellValue } from "./components/as-table-cell-value.vue";
export { default as AsTableVirtualizer } from "./components/as-table-virtualizer.vue";

// ── Default components ──────────────────────────────────────
export {
  createDefaultTableComponents,
  AsFilterBar,
  AsFilterField,
  AsFilterDialog,
  AsFilterInput,
  AsTablePagination,
  AsColumnMenu,
} from "./components/defaults";

// ── Utilities ───────────────────────────────────────────────
export { getColumnWidth } from "./utils/column-width";
export { getCellValue } from "./utils/get-cell-value";
export { formatCellValue } from "./utils/format-cell";
